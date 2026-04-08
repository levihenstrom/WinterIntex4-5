using System.Text.Json.Serialization;

namespace Intex.API.Contracts.Ml;

/// <summary>JSON shape under App_Data/ml/reintegration/*.json (snake_case on disk).</summary>
internal sealed class ResidentReadinessArtifactRecord
{
    [JsonPropertyName("resident_code")]
    public string ResidentCode { get; set; } = "";

    [JsonPropertyName("as_of_date")]
    public string? AsOfDate { get; set; }

    [JsonPropertyName("reintegration_readiness_score")]
    public double ReintegrationReadinessScore { get; set; }

    [JsonPropertyName("readiness_percentile_among_current_residents")]
    public double? ReadinessPercentileAmongCurrentResidents { get; set; }

    [JsonPropertyName("support_priority_rank")]
    public int SupportPriorityRank { get; set; }

    [JsonPropertyName("operational_band")]
    public string OperationalBand { get; set; } = "";

    [JsonPropertyName("top_positive_factors")]
    public List<string>? TopPositiveFactors { get; set; }

    [JsonPropertyName("top_risk_factors")]
    public List<string>? TopRiskFactors { get; set; }

    [JsonPropertyName("raw_score_note")]
    public string? RawScoreNote { get; set; }

    [JsonPropertyName("top_positive_factors_short")]
    public List<string>? TopPositiveFactorsShort { get; set; }

    [JsonPropertyName("top_risk_factors_short")]
    public List<string>? TopRiskFactorsShort { get; set; }
}

/// <summary>API response for resident readiness (camelCase JSON via default serializer).</summary>
public sealed class ResidentReadinessDto
{
    /// <summary>Numeric primary key from the residents table — null if the ML artifact has no matching resident row.</summary>
    public int? ResidentId { get; init; }
    public string ResidentCode { get; init; } = "";
    public string? AsOfDate { get; init; }
    public double ReintegrationReadinessScore { get; init; }
    public double? ReadinessPercentileAmongCurrentResidents { get; init; }
    public int SupportPriorityRank { get; init; }
    public string OperationalBand { get; init; } = "";
    public IReadOnlyList<string> TopPositiveFactors { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> TopRiskFactors { get; init; } = Array.Empty<string>();
    public string? RawScoreNote { get; init; }
    public IReadOnlyList<string>? TopPositiveFactorsShort { get; init; }
    public IReadOnlyList<string>? TopRiskFactorsShort { get; init; }

    internal ResidentReadinessDto WithResidentId(int? id) => new()
    {
        ResidentId = id,
        ResidentCode = ResidentCode,
        AsOfDate = AsOfDate,
        ReintegrationReadinessScore = ReintegrationReadinessScore,
        ReadinessPercentileAmongCurrentResidents = ReadinessPercentileAmongCurrentResidents,
        SupportPriorityRank = SupportPriorityRank,
        OperationalBand = OperationalBand,
        TopPositiveFactors = TopPositiveFactors,
        TopRiskFactors = TopRiskFactors,
        RawScoreNote = RawScoreNote,
        TopPositiveFactorsShort = TopPositiveFactorsShort,
        TopRiskFactorsShort = TopRiskFactorsShort,
    };

    internal static ResidentReadinessDto FromArtifact(ResidentReadinessArtifactRecord r, int? residentId = null) => new()
    {
        ResidentId = residentId,
        ResidentCode = r.ResidentCode,
        AsOfDate = r.AsOfDate,
        ReintegrationReadinessScore = r.ReintegrationReadinessScore,
        ReadinessPercentileAmongCurrentResidents = r.ReadinessPercentileAmongCurrentResidents,
        SupportPriorityRank = r.SupportPriorityRank,
        OperationalBand = r.OperationalBand,
        TopPositiveFactors = r.TopPositiveFactors is null ? Array.Empty<string>() : r.TopPositiveFactors,
        TopRiskFactors = r.TopRiskFactors is null ? Array.Empty<string>() : r.TopRiskFactors,
        RawScoreNote = r.RawScoreNote,
        TopPositiveFactorsShort = r.TopPositiveFactorsShort,
        TopRiskFactorsShort = r.TopRiskFactorsShort,
    };
}
