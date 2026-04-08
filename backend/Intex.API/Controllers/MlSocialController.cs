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

        var configBlock = proxy.GetBlockingConfigurationProblem();
        if (configBlock is not null)
            return StatusCode(configBlock.Status ?? StatusCodes.Status503ServiceUnavailable, configBlock);

        try
        {
            var result = await proxy.RecommendAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (MlInferenceUpstreamException ex)
        {
            return StatusCode(ex.StatusCode, new ProblemDetails
            {
                Title = ex.PublicTitle,
                Detail = ex.PublicDetail,
                Status = ex.StatusCode,
            });
        }
    }
}
