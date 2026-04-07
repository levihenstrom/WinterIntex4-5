using System.Net.Http.Json;
using System.Text.Json;
using Intex.API.Contracts.Ml;
using Intex.API.Options;
using Microsoft.Extensions.Options;

namespace Intex.API.Services;

public sealed class MlSocialProxyService(
    HttpClient httpClient,
    IOptions<MlInferenceServiceOptions> options,
    ILogger<MlSocialProxyService> logger)
{
    private static readonly JsonSerializerOptions SnakeCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    private static readonly JsonSerializerOptions SnakeCaseRead = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
    };

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(options.Value.BaseUrl);

    public async Task<SocialRecommendResponseDto?> RecommendAsync(
        SocialRecommendRequestDto request,
        CancellationToken cancellationToken)
    {
        if (httpClient.BaseAddress is null)
            return null;

        var fixedDict = BuildFixedInputs(request.FixedInputs);
        var payload = new PythonSocialRecommendPayload
        {
            Goal = request.Goal.Trim().ToLowerInvariant(),
            FixedInputs = fixedDict.Count > 0 ? fixedDict : null,
            TopK = request.TopK,
        };

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "social/recommend")
        {
            Content = JsonContent.Create(payload, options: SnakeCase),
        };

        using var response = await httpClient.SendAsync(httpRequest, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning(
                "Social ML service returned {Status}: {Body}",
                (int)response.StatusCode,
                body.Length > 500 ? body[..500] + "…" : body);
            throw new HttpRequestException($"Social ML service returned {(int)response.StatusCode}.");
        }

        var parsed = JsonSerializer.Deserialize<PythonSocialRecommendResponse>(body, SnakeCaseRead);
        if (parsed?.Recommendations is null)
            return new SocialRecommendResponseDto { Goal = parsed?.Goal ?? request.Goal, TopK = request.TopK, Recommendations = [] };

        var recs = parsed.Recommendations.ConvertAll(SocialRecommendationDto.FromPython);
        return new SocialRecommendResponseDto
        {
            Goal = parsed.Goal,
            TopK = parsed.TopK,
            Recommendations = recs,
        };
    }

    private static Dictionary<string, object?> BuildFixedInputs(SocialFixedInputsDto? f)
    {
        if (f is null)
            return new Dictionary<string, object?>();

        var d = new Dictionary<string, object?>();
        void Add(string key, object? v)
        {
            if (v is not null)
                d[key] = v;
        }

        Add("content_topic", f.ContentTopic);
        Add("platform", f.Platform);
        Add("post_type", f.PostType);
        Add("media_type", f.MediaType);
        if (f.HasCallToAction.HasValue)
            d["has_call_to_action"] = f.HasCallToAction.Value ? 1.0 : 0.0;
        Add("call_to_action_type", f.CallToActionType);
        if (f.FeaturesResidentStory.HasValue)
            d["features_resident_story"] = f.FeaturesResidentStory.Value ? 1.0 : 0.0;
        if (f.PostHour.HasValue)
            d["post_hour"] = f.PostHour.Value;

        return d;
    }
}
