using System.Text.Json;
using Intex.API.Contracts.Ml;
using Microsoft.AspNetCore.Hosting;

namespace Intex.API.Services;

public sealed class MlArtifactService(IWebHostEnvironment env, ILogger<MlArtifactService> logger)
{
    private static readonly JsonSerializerOptions ReadJson = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private string ReintegrationPath(string fileName) =>
        Path.Combine(env.ContentRootPath, MlArtifactLayout.Reintegration, fileName);

    private string DonorsPath(string fileName) =>
        Path.Combine(env.ContentRootPath, MlArtifactLayout.Donors, fileName);

    private void EnsureFileExists(string path, string logicalName)
    {
        if (!File.Exists(path))
        {
            logger.LogWarning("ML artifact missing: {Logical} ({Path})", logicalName, path);
            throw new FileNotFoundException($"ML artifact not found: {logicalName}. Run the Python export (refresh_ml_artifacts) and publish.", path);
        }
    }

    public async Task<IReadOnlyList<ResidentReadinessDto>> GetResidentsCurrentScoresAsync(CancellationToken cancellationToken)
    {
        var path = ReintegrationPath("current_resident_scores.json");
        EnsureFileExists(path, "reintegration/current_resident_scores.json");
        await using var stream = File.OpenRead(path);
        var rows = await JsonSerializer.DeserializeAsync<List<ResidentReadinessArtifactRecord>>(stream, ReadJson, cancellationToken)
                   ?? [];
        return rows.ConvertAll(r => ResidentReadinessDto.FromArtifact(r));
    }

    public async Task<IReadOnlyList<ResidentReadinessDto>> GetResidentsPriorityAsync(int limit, CancellationToken cancellationToken)
    {
        if (limit is < 1 or > 500)
            throw new ArgumentOutOfRangeException(nameof(limit), limit, "Limit must be between 1 and 500.");

        var all = await GetResidentsCurrentScoresAsync(cancellationToken);
        return all.OrderBy(r => r.SupportPriorityRank).Take(limit).ToList();
    }

    public async Task<ResidentReadinessDto?> GetResidentByCodeAsync(string residentCode, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(residentCode))
            return null;

        var all = await GetResidentsCurrentScoresAsync(cancellationToken);
        return all.FirstOrDefault(r =>
            string.Equals(r.ResidentCode, residentCode.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public async Task<IReadOnlyList<DonorChurnScoreDto>> GetDonorsCurrentScoresAsync(CancellationToken cancellationToken)
    {
        var path = DonorsPath("current_donor_scores.json");
        EnsureFileExists(path, "donors/current_donor_scores.json");
        await using var stream = File.OpenRead(path);
        var rows = await JsonSerializer.DeserializeAsync<List<DonorChurnArtifactRecord>>(stream, ReadJson, cancellationToken)
                   ?? [];
        return rows.ConvertAll(DonorChurnScoreDto.FromArtifact);
    }

    public async Task<IReadOnlyList<DonorChurnScoreDto>> GetDonorsAtRiskAsync(int limit, CancellationToken cancellationToken)
    {
        if (limit is < 1 or > 500)
            throw new ArgumentOutOfRangeException(nameof(limit), limit, "Limit must be between 1 and 500.");

        var all = await GetDonorsCurrentScoresAsync(cancellationToken);
        return all.OrderBy(d => d.OutreachPriorityRank).Take(limit).ToList();
    }

    public async Task<DonorChurnScoreDto?> GetDonorByIdAsync(int supporterId, CancellationToken cancellationToken)
    {
        var all = await GetDonorsCurrentScoresAsync(cancellationToken);
        return all.FirstOrDefault(d => d.SupporterId == supporterId);
    }
}
