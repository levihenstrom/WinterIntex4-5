using System.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Data;

/// <summary>
/// After EF creates an empty schema, optionally reloads CSV data via the Python pipeline
/// (<c>scripts/build_intex_sqlite.py --data-only</c>) so local SQLite matches the Lighthouse dataset.
/// </summary>
public static class IntexDevSeedRunner
{
    public static async Task RunPythonCsvSeedIfConfiguredAsync(
        IHostEnvironment env,
        IConfiguration config,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        if (!config.GetValue("Intex:SeedCsvAfterMigrate", false))
            return;

        var repoRoot = Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", ".."));
        var script = Path.Combine(repoRoot, "scripts", "build_intex_sqlite.py");
        if (!File.Exists(script))
        {
            logger.LogWarning("Intex CSV seed script not found at {Path}", script);
            return;
        }

        var resolved = ResolvePython();
        if (resolved is null)
        {
            logger.LogWarning(
                "Python executable not found on PATH; skipping CSV seed. Run manually from repo root: python scripts/build_intex_sqlite.py --data-only");
            return;
        }

        var (exe, argPrefix) = resolved.Value;
        var args = $"{argPrefix}\"{script}\" --data-only";

        var psi = new ProcessStartInfo
        {
            FileName = exe,
            Arguments = args,
            WorkingDirectory = repoRoot,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var proc = Process.Start(psi);
        if (proc is null)
        {
            logger.LogWarning("Could not start Python process for CSV seed.");
            return;
        }

        await proc.WaitForExitAsync(cancellationToken);
        var stdout = await proc.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderr = await proc.StandardError.ReadToEndAsync(cancellationToken);
        if (proc.ExitCode != 0)
            logger.LogError("CSV seed failed (exit {Code}). stderr: {Err} stdout: {Out}", proc.ExitCode, stderr, stdout);
        else
            logger.LogInformation("CSV seed finished.\n{Out}", stdout);
    }

    /// <summary>Returns executable name and argument prefix (e.g. py launcher needs "-3 ").</summary>
    static (string exe, string argPrefix)? ResolvePython()
    {
        if (CanRun("python", "--version"))
            return ("python", "");
        if (CanRun("py", "-3 --version"))
            return ("py", "-3 ");
        return null;
    }

    static bool CanRun(string fileName, string arguments)
    {
        try
        {
            using var p = Process.Start(
                new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = arguments,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                });
            if (p is null)
                return false;
            return p.WaitForExit(8000) && p.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Runs <see cref="RunPythonCsvSeedIfConfiguredAsync"/> when the residents table is empty (typical after first migrate).
    /// </summary>
    public static async Task SeedAfterMigrateIfEmptyAsync(
        AppDbContext db,
        IHostEnvironment env,
        IConfiguration config,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        if (!await db.Residents.AnyAsync(cancellationToken))
            await RunPythonCsvSeedIfConfiguredAsync(env, config, logger, cancellationToken);
    }
}
