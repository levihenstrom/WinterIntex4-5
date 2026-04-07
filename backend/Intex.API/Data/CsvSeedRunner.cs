using System.Data.Common;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualBasic.FileIO;

namespace Intex.API.Data;

public static class CsvSeedRunner
{
    private static readonly (string Table, string File)[] LoadOrder =
    [
        ("safehouses", "safehouses.csv"),
        ("partners", "partners.csv"),
        ("supporters", "supporters.csv"),
        ("social_media_posts", "social_media_posts.csv"),
        ("partner_assignments", "partner_assignments.csv"),
        ("donations", "donations.csv"),
        ("in_kind_donation_items", "in_kind_donation_items.csv"),
        ("donation_allocations", "donation_allocations.csv"),
        ("residents", "residents.csv"),
        ("process_recordings", "process_recordings.csv"),
        ("home_visitations", "home_visitations.csv"),
        ("education_records", "education_records.csv"),
        ("health_wellbeing_records", "health_wellbeing_records.csv"),
        ("intervention_plans", "intervention_plans.csv"),
        ("incident_reports", "incident_reports.csv"),
        ("safehouse_monthly_metrics", "safehouse_monthly_metrics.csv"),
        ("public_impact_snapshots", "public_impact_snapshots.csv")
    ];

    private static readonly string[] DeleteOrder =
    [
        "public_impact_snapshots",
        "safehouse_monthly_metrics",
        "incident_reports",
        "intervention_plans",
        "health_wellbeing_records",
        "education_records",
        "home_visitations",
        "process_recordings",
        "residents",
        "donation_allocations",
        "in_kind_donation_items",
        "donations",
        "partner_assignments",
        "social_media_posts",
        "supporters",
        "partners",
        "safehouses"
    ];

    public static async Task SeedFromCsvIfConfiguredAsync(
        AppDbContext db,
        IHostEnvironment env,
        IConfiguration config,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        var enabled = config.GetValue("Intex:SeedCsvAtStartup", false);
        if (!enabled)
            return;

        var allowProd = config.GetValue("Intex:AllowProductionCsvSeed", false);
        if (!env.IsDevelopment() && !allowProd)
        {
            logger.LogWarning(
                "Skipping CSV seed in {Environment}. Set Intex:AllowProductionCsvSeed=true to run intentionally.",
                env.EnvironmentName);
            return;
        }

        var replaceExisting = config.GetValue("Intex:SeedCsvReplaceExisting", false);
        logger.LogInformation(
            "CSV seed requested. Environment={Environment}, ReplaceExisting={ReplaceExisting}, Provider={Provider}",
            env.EnvironmentName,
            replaceExisting,
            db.Database.ProviderName);

        if (!replaceExisting && await db.Supporters.AsNoTracking().AnyAsync(cancellationToken))
        {
            logger.LogInformation(
                "Skipping CSV seed because supporters table already has data (set Intex:SeedCsvReplaceExisting=true to force reload).");
            return;
        }

        await SeedFromCsvAsync(db, env, logger, cancellationToken);
    }

    public static async Task SeedFromCsvAsync(
        AppDbContext db,
        IHostEnvironment env,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        var csvDir = ResolveCsvDirectory(env);
        if (csvDir is null)
        {
            logger.LogError(
                "CSV seed requested but data/lighthouse_csv_v7 was not found in the deployed content. Skipping seed.");
            return;
        }

        var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(cancellationToken);

        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var isSqlServer = db.Database.IsSqlServer();

        try
        {
            foreach (var table in DeleteOrder)
                await ExecuteNonQueryAsync(connection, transaction, $"DELETE FROM [{table}];", cancellationToken);

            var identityTables = isSqlServer
                ? await GetIdentityTablesAsync(connection, transaction, cancellationToken)
                : new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var (table, file) in LoadOrder)
            {
                var path = Path.Combine(csvDir, file);
                if (!File.Exists(path))
                    throw new FileNotFoundException($"CSV file not found: {path}");

                var rowsLoaded = await InsertCsvTableAsync(
                    connection,
                    transaction,
                    table,
                    path,
                    identityTables.Contains(table),
                    cancellationToken);

                logger.LogInformation("CSV seed loaded {Rows} rows into {Table}", rowsLoaded, table);
            }

            await transaction.CommitAsync(cancellationToken);
            logger.LogInformation("CSV seed completed successfully.");
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
        finally
        {
            await connection.CloseAsync();
        }
    }

    private static async Task<int> InsertCsvTableAsync(
        DbConnection connection,
        DbTransaction transaction,
        string table,
        string csvPath,
        bool enableIdentityInsert,
        CancellationToken cancellationToken)
    {
        using var parser = new TextFieldParser(csvPath)
        {
            TextFieldType = FieldType.Delimited,
            HasFieldsEnclosedInQuotes = true
        };
        parser.SetDelimiters(",");

        if (parser.EndOfData)
            return 0;

        var headers = parser.ReadFields();
        if (headers is null || headers.Length == 0)
            throw new InvalidOperationException($"No header row found in {csvPath}");

        if (enableIdentityInsert)
            await ExecuteNonQueryAsync(connection, transaction, $"SET IDENTITY_INSERT [{table}] ON;", cancellationToken);

        var parameterNames = headers.Select((_, i) => $"@p{i}").ToArray();
        var insertSql =
            $"INSERT INTO [{table}] ({string.Join(",", headers.Select(h => $"[{h}]"))}) VALUES ({string.Join(",", parameterNames)});";

        var loaded = 0;
        while (!parser.EndOfData)
        {
            var fields = parser.ReadFields() ?? [];

            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = insertSql;

            for (var i = 0; i < headers.Length; i++)
            {
                var value = i < fields.Length ? ParseCell(headers[i], fields[i]) : null;
                var parameter = command.CreateParameter();
                parameter.ParameterName = parameterNames[i];
                parameter.Value = value ?? DBNull.Value;
                command.Parameters.Add(parameter);
            }

            await command.ExecuteNonQueryAsync(cancellationToken);
            loaded++;
        }

        if (enableIdentityInsert)
            await ExecuteNonQueryAsync(connection, transaction, $"SET IDENTITY_INSERT [{table}] OFF;", cancellationToken);

        return loaded;
    }

    private static async Task<HashSet<string>> GetIdentityTablesAsync(
        DbConnection connection,
        DbTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT t.name
            FROM sys.identity_columns ic
            JOIN sys.tables t ON ic.object_id = t.object_id
            JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE s.name = 'dbo';
            """;

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;

        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            result.Add(reader.GetString(0));

        return result;
    }

    private static async Task ExecuteNonQueryAsync(
        DbConnection connection,
        DbTransaction transaction,
        string sql,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static object? ParseCell(string column, string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var s = raw.Trim();
        if (string.Equals(s, "True", StringComparison.OrdinalIgnoreCase))
            return true;
        if (string.Equals(s, "False", StringComparison.OrdinalIgnoreCase))
            return false;

        if (IsLikelyIntegerColumn(column))
        {
            if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var asDouble))
                return Convert.ToInt32(Math.Truncate(asDouble));
            return s;
        }

        if (decimal.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var asDecimal))
            return asDecimal;

        return raw;
    }

    private static bool IsLikelyIntegerColumn(string column) =>
        column.EndsWith("_id", StringComparison.OrdinalIgnoreCase)
        || column is
            "allocation_id" or "recording_id" or "visitation_id" or "education_record_id" or "health_record_id"
            or "plan_id" or "incident_id" or "metric_id" or "snapshot_id" or "item_id" or "assignment_id"
            or "post_hour" or "num_hashtags" or "mentions_count" or "caption_length"
            or "session_duration_minutes" or "quantity" or "capacity_girls" or "capacity_staff" or "current_occupancy"
            or "impressions" or "reach" or "likes" or "comments" or "shares" or "saves" or "click_throughs" or "video_views"
            or "profile_visits" or "donation_referrals" or "follower_count_at_post" or "watch_time_seconds"
            or "avg_view_duration_seconds" or "subscriber_count_at_post" or "active_residents"
            or "process_recording_count" or "home_visitation_count" or "incident_count";

    private static string? ResolveCsvDirectory(IHostEnvironment env)
    {
        var candidates = new[]
        {
            Path.Combine(env.ContentRootPath, "data", "lighthouse_csv_v7"),
            Path.Combine(Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..")), "data", "lighthouse_csv_v7")
        };

        return candidates.FirstOrDefault(Directory.Exists);
    }
}
