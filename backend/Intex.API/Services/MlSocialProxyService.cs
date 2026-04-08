using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Intex.API.Contracts.Ml;
using Intex.API.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Intex.API.Services;

/// <summary>Proxies social post recommendations to the Python FastAPI ML service.</summary>
public sealed class MlSocialProxyService(
    HttpClient httpClient,
    IOptions<MlInferenceServiceOptions> options,
    ILogger<MlSocialProxyService> logger)
{
    /// <summary>Serialize outbound body: snake_case keys and explicit nulls in <c>fixed_inputs</c> when provided.</summary>
    private static readonly JsonSerializerOptions SnakeCaseWithNulls = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };

    private static readonly JsonSerializerOptions SnakeCaseRead = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>
    /// When non-null, the API should return this problem immediately (misconfiguration).
    /// When null, outbound calls may proceed (upstream may still fail).
    /// </summary>
    public ProblemDetails? GetBlockingConfigurationProblem()
    {
        var raw = options.Value.BaseUrl?.Trim() ?? "";
        if (raw.Length == 0)
        {
            return new ProblemDetails
            {
                Title = "Social ML inference service is not configured.",
                Detail =
                    "Set MlInferenceService:BaseUrl to your FastAPI root URL (e.g. http://127.0.0.1:8001 when running uvicorn locally).",
                Status = StatusCodes.Status503ServiceUnavailable,
            };
        }

        if (!MlInferenceBaseUrlHelper.TryCreateHttpClientBaseUri(options.Value.BaseUrl, out _))
        {
            return new ProblemDetails
            {
                Title = "Social ML BaseUrl is invalid.",
                Detail = "MlInferenceService:BaseUrl must be an absolute http or https URL.",
                Status = StatusCodes.Status503ServiceUnavailable,
            };
        }

        if (httpClient.BaseAddress is null)
        {
            return new ProblemDetails
            {
                Title = "Social ML HTTP client is not initialized.",
                Detail =
                    "The server could not configure the outbound client for the ML service. Check MlInferenceService:BaseUrl and application logs.",
                Status = StatusCodes.Status503ServiceUnavailable,
            };
        }

        return null;
    }

    /// <summary>
    /// Calls FastAPI <c>POST /social/recommend</c>. Throws <see cref="MlInferenceUpstreamException"/> for all failure modes
    /// except client cancellation (<paramref name="cancellationToken"/>).
    /// </summary>
    public async Task<SocialRecommendResponseDto> RecommendAsync(
        SocialRecommendRequestDto request,
        CancellationToken cancellationToken)
    {
        if (httpClient.BaseAddress is null)
        {
            throw new MlInferenceUpstreamException(
                StatusCodes.Status503ServiceUnavailable,
                "Social ML HTTP client is not initialized.",
                "The live recommendation client is not configured. Check MlInferenceService:BaseUrl.");
        }

        var fixedDict = request.FixedInputs is null ? null : BuildFixedInputsExplicit(request.FixedInputs);
        var payload = new PythonSocialRecommendPayload
        {
            Goal = request.Goal.Trim().ToLowerInvariant(),
            FixedInputs = fixedDict,
            TopK = request.TopK,
        };

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "social/recommend")
        {
            Content = JsonContent.Create(payload, options: SnakeCaseWithNulls),
        };

        string body;
        try
        {
            using var response = await httpClient
                .SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
                .ConfigureAwait(false);
            body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Social ML upstream returned HTTP {Status}. Response length: {Length} bytes.",
                    (int)response.StatusCode,
                    body.Length);
                throw new MlInferenceUpstreamException(
                    StatusCodes.Status502BadGateway,
                    "The social ML service returned an error.",
                    "The inference service could not complete this request. Try again later.");
            }
        }
        catch (MlInferenceUpstreamException)
        {
            throw;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException ex)
        {
            logger.LogWarning(ex, "Social ML request timed out or was canceled by the HTTP client.");
            throw new MlInferenceUpstreamException(
                StatusCodes.Status504GatewayTimeout,
                "The social ML service did not respond in time.",
                "The inference service timed out. Try again later.",
                ex);
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Social ML HTTP request failed (network or connection error).");
            throw new MlInferenceUpstreamException(
                StatusCodes.Status503ServiceUnavailable,
                "The social ML service is unavailable.",
                "The inference service could not be reached. It may be down or unreachable from this environment.",
                ex);
        }

        PythonSocialRecommendResponse? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<PythonSocialRecommendResponse>(body, SnakeCaseRead);
        }
        catch (JsonException ex)
        {
            logger.LogError(ex, "Failed to deserialize social ML JSON response.");
            throw new MlInferenceUpstreamException(
                StatusCodes.Status502BadGateway,
                "The social ML service returned an invalid response.",
                "The inference service response could not be processed.",
                ex);
        }

        if (parsed is null)
        {
            throw new MlInferenceUpstreamException(
                StatusCodes.Status502BadGateway,
                "The social ML service returned an invalid response.",
                "The inference service response was empty or malformed.");
        }

        if (parsed.Recommendations is null)
        {
            return new SocialRecommendResponseDto
            {
                Goal = string.IsNullOrEmpty(parsed.Goal) ? request.Goal.Trim().ToLowerInvariant() : parsed.Goal,
                TopK = parsed.TopK > 0 ? parsed.TopK : request.TopK,
                Recommendations = [],
            };
        }

        var recs = parsed.Recommendations.ConvertAll(SocialRecommendationDto.FromPython);
        return new SocialRecommendResponseDto
        {
            Goal = parsed.Goal,
            TopK = parsed.TopK,
            Recommendations = recs,
        };
    }

    /// <summary>Maps frontend DTO fields to FastAPI <c>fixed_inputs</c> snake_case keys, including explicit nulls.</summary>
    private static Dictionary<string, object?> BuildFixedInputsExplicit(SocialFixedInputsDto f)
    {
        static object? NumericBool(bool? b) => b switch
        {
            true => 1.0,
            false => 0.0,
            null => null,
        };

        return new Dictionary<string, object?>
        {
            ["content_topic"] = f.ContentTopic,
            ["platform"] = f.Platform,
            ["post_type"] = f.PostType,
            ["media_type"] = f.MediaType,
            ["has_call_to_action"] = NumericBool(f.HasCallToAction),
            ["call_to_action_type"] = f.CallToActionType,
            ["features_resident_story"] = NumericBool(f.FeaturesResidentStory),
            ["post_hour"] = f.PostHour,
        };
    }
}
