using Intex.API.Contracts.Ml;
using Intex.API.Data;
using Intex.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/ml/residents")]
[Authorize(Policy = AuthPolicies.StaffRead)]
public sealed class MlResidentsController(MlArtifactService ml) : ControllerBase
{
    [HttpGet("priority")]
    [ProducesResponseType(typeof(IReadOnlyList<ResidentReadinessDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetPriority([FromQuery] int limit = 10, CancellationToken cancellationToken = default)
    {
        if (limit is < 1 or > 500)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid limit.",
                Detail = "Limit must be between 1 and 500.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        try
        {
            var list = await ml.GetResidentsPriorityAsync(limit, cancellationToken);
            return Ok(list);
        }
        catch (FileNotFoundException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "ML reintegration data is not available.",
                Detail = ex.Message,
                Status = StatusCodes.Status503ServiceUnavailable,
            });
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid argument.",
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest,
            });
        }
    }

    [HttpGet("current-scores")]
    [ProducesResponseType(typeof(IReadOnlyList<ResidentReadinessDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetCurrentScores(CancellationToken cancellationToken = default)
    {
        try
        {
            var list = await ml.GetResidentsCurrentScoresAsync(cancellationToken);
            return Ok(list);
        }
        catch (FileNotFoundException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "ML reintegration data is not available.",
                Detail = ex.Message,
                Status = StatusCodes.Status503ServiceUnavailable,
            });
        }
    }

    [HttpGet("{residentCode}/readiness")]
    [ProducesResponseType(typeof(ResidentReadinessDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetReadiness(string residentCode, CancellationToken cancellationToken = default)
    {
        try
        {
            var row = await ml.GetResidentByCodeAsync(residentCode, cancellationToken);
            if (row is null)
                return NotFound();
            return Ok(row);
        }
        catch (FileNotFoundException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "ML reintegration data is not available.",
                Detail = ex.Message,
                Status = StatusCodes.Status503ServiceUnavailable,
            });
        }
    }
}
