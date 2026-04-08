using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Intex.API.Contracts.Ml;

public sealed class SocialRecommendRequestDto
{
    [Required]
    [RegularExpression("^(?i)(donations|awareness|mixed)$", ErrorMessage = "Goal must be donations, awareness, or mixed.")]
    public string Goal { get; set; } = "";

    public SocialFixedInputsDto? FixedInputs { get; set; }

    [Range(1, 50)]
    public int TopK { get; set; } = 3;
}

public sealed class SocialFixedInputsDto
{
    public string? ContentTopic { get; set; }
    public string? Platform { get; set; }
    public string? PostType { get; set; }
    public string? MediaType { get; set; }
    public bool? HasCallToAction { get; set; }
    public string? CallToActionType { get; set; }
    public bool? FeaturesResidentStory { get; set; }
    public int? PostHour { get; set; }
}

/// <summary>Serialized to FastAPI with snake_case naming.</summary>
internal sealed class PythonSocialRecommendPayload
{
    public string Goal { get; set; } = "";

    /// <summary>Omitted when null so FastAPI applies its <c>fixed_inputs</c> default; when set, all keys are sent (including JSON nulls).</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Dictionary<string, object?>? FixedInputs { get; set; }

    public int TopK { get; set; }
}

internal sealed class PythonSocialRecommendResponse
{
    public string Goal { get; set; } = "";

    [JsonPropertyName("top_k")]
    public int TopK { get; set; }

    public List<PythonRecommendationRecord>? Recommendations { get; set; }
}

internal sealed class PythonRecommendationRecord
{
    public string Platform { get; set; } = "";
    public string PostType { get; set; } = "";
    public string MediaType { get; set; } = "";
    public int PostHour { get; set; }
    public string ContentTopic { get; set; } = "";
    public bool HasCallToAction { get; set; }
    public string CallToActionType { get; set; } = "";
    public bool FeaturesResidentStory { get; set; }
    public double PredictedEngagementRate { get; set; }
    public double PredictedPAnyReferral { get; set; }
    public double? PredictedReferralsCount { get; set; }
    public double RankingScore { get; set; }
    public string Goal { get; set; } = "";
    public string WhyRecommended { get; set; } = "";
}

public sealed class SocialRecommendResponseDto
{
    public string Goal { get; init; } = "";
    public int TopK { get; init; }
    public IReadOnlyList<SocialRecommendationDto> Recommendations { get; init; } = Array.Empty<SocialRecommendationDto>();
}

public sealed class SocialRecommendationDto
{
    public string Platform { get; init; } = "";
    public string PostType { get; init; } = "";
    public string MediaType { get; init; } = "";
    public int PostHour { get; init; }
    public string ContentTopic { get; init; } = "";
    public bool HasCallToAction { get; init; }
    public string CallToActionType { get; init; } = "";
    public bool FeaturesResidentStory { get; init; }
    public double PredictedEngagementRate { get; init; }
    public double PredictedPAnyReferral { get; init; }
    public double? PredictedReferralsCount { get; init; }
    public double RankingScore { get; init; }
    public string Goal { get; init; } = "";
    public string WhyRecommended { get; init; } = "";

    internal static SocialRecommendationDto FromPython(PythonRecommendationRecord r) => new()
    {
        Platform = r.Platform,
        PostType = r.PostType,
        MediaType = r.MediaType,
        PostHour = r.PostHour,
        ContentTopic = r.ContentTopic,
        HasCallToAction = r.HasCallToAction,
        CallToActionType = r.CallToActionType,
        FeaturesResidentStory = r.FeaturesResidentStory,
        PredictedEngagementRate = r.PredictedEngagementRate,
        PredictedPAnyReferral = r.PredictedPAnyReferral,
        PredictedReferralsCount = r.PredictedReferralsCount,
        RankingScore = r.RankingScore,
        Goal = r.Goal,
        WhyRecommended = r.WhyRecommended,
    };
}
