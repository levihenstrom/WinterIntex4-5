using System.Text.Json.Serialization;

namespace Intex.API.Contracts.Ml;

internal sealed class DonorChurnArtifactRecord
{
    [JsonPropertyName("supporter_id")]
    public int SupporterId { get; set; }

    [JsonPropertyName("display_name")]
    public string DisplayName { get; set; } = "";

    [JsonPropertyName("churn_risk_score")]
    public double ChurnRiskScore { get; set; }

    [JsonPropertyName("outreach_priority_rank")]
    public int OutreachPriorityRank { get; set; }

    [JsonPropertyName("risk_band")]
    public string RiskBand { get; set; } = "";

    [JsonPropertyName("top_drivers")]
    public List<string>? TopDrivers { get; set; }

    [JsonPropertyName("outreach_note")]
    public string? OutreachNote { get; set; }
}

public sealed class DonorChurnScoreDto
{
    public int SupporterId { get; init; }
    public string DisplayName { get; init; } = "";
    public double ChurnRiskScore { get; init; }
    public int OutreachPriorityRank { get; init; }
    public string RiskBand { get; init; } = "";
    public IReadOnlyList<string> TopDrivers { get; init; } = Array.Empty<string>();
    public string? OutreachNote { get; init; }

    internal static DonorChurnScoreDto FromArtifact(DonorChurnArtifactRecord r) => new()
    {
        SupporterId = r.SupporterId,
        DisplayName = r.DisplayName,
        ChurnRiskScore = r.ChurnRiskScore,
        OutreachPriorityRank = r.OutreachPriorityRank,
        RiskBand = r.RiskBand,
        TopDrivers = r.TopDrivers is null ? Array.Empty<string>() : r.TopDrivers,
        OutreachNote = r.OutreachNote,
    };
}
