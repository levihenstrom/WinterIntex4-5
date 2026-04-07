using Intex.API.Contracts.Ml;
using Intex.API.Data;
using Intex.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/ml/social")]
[Authorize(Policy = AuthPolicies.StaffRead)]
public sealed class MlSocialController(MlSocialProxyService proxy) : ControllerBase
{
    [HttpPost("recommend")]
    [ProducesResponseType(typeof(SocialRecommendResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status502BadGateway)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status504GatewayTimeout)]
    public async Task<IActionResult> Recommend(
        [FromBody] SocialRecommendRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (!proxy.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "Social ML inference service is not configured.",
                Detail = "Set MlInferenceService:BaseUrl (e.g. in appsettings.Development.json) to the FastAPI base URL.",
                Status = StatusCodes.Status503ServiceUnavailable,
            });
        }

        try
        {
            var result = await proxy.RecommendAsync(request, cancellationToken);
            if (result is null)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
                {
                    Title = "Social ML inference service is not configured.",
                    Status = StatusCodes.Status503ServiceUnavailable,
                });
            }

            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new ProblemDetails
            {
                Title = "Social ML service returned an error.",
                Detail = ex.Message,
                Status = StatusCodes.Status502BadGateway,
            });
        }
        catch (TaskCanceledException)
        {
            return StatusCode(StatusCodes.Status504GatewayTimeout, new ProblemDetails
            {
                Title = "Social ML service request timed out.",
                Status = StatusCodes.Status504GatewayTimeout,
            });
        }
    }
}
