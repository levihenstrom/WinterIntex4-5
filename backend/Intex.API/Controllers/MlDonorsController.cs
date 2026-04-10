using Intex.API.Authorization;
using Intex.API.Contracts.Ml;
using Intex.API.Data;
using Intex.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/ml/donors")]
[Authorize(Policy = AuthPolicies.StaffRead)]
public sealed class MlDonorsController(MlArtifactService ml, AppDbContext db, StaffScopeResolver scopeResolver) : ControllerBase
{
    private async Task<IReadOnlyList<DonorChurnScoreDto>> ScopeAsync(
        IReadOnlyList<DonorChurnScoreDto> list, CancellationToken ct)
    {
        var scope = await scopeResolver.GetForUserAsync(User, ct);
        if (scope.IsAdmin)
            return list;
        if (scope.SafehouseIds.Count == 0)
            return [];

        var visibleIds = await scope.Apply(db.Supporters.AsNoTracking())
            .Select(s => s.SupporterId)
            .ToHashSetAsync(ct);

        return list.Where(d => visibleIds.Contains(d.SupporterId)).ToList();
    }

    [HttpGet("at-risk")]
    [ProducesResponseType(typeof(IReadOnlyList<DonorChurnScoreDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetAtRisk([FromQuery] int limit = 10, CancellationToken cancellationToken = default)
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
            var list = await ml.GetDonorsAtRiskAsync(limit, cancellationToken);
            return Ok(await ScopeAsync(list, cancellationToken));
        }
        catch (FileNotFoundException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "ML donor data is not available.",
                Detail = ex.Message,
                Status = StatusCodes.Status503ServiceUnavailable,
            });
        }
    }

    [HttpGet("current-scores")]
    [ProducesResponseType(typeof(IReadOnlyList<DonorChurnScoreDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetCurrentScores(CancellationToken cancellationToken = default)
    {
        try
        {
            var list = await ml.GetDonorsCurrentScoresAsync(cancellationToken);
            return Ok(await ScopeAsync(list, cancellationToken));
        }
        catch (FileNotFoundException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "ML donor data is not available.",
                Detail = ex.Message,
                Status = StatusCodes.Status503ServiceUnavailable,
            });
        }
    }

    [HttpGet("{supporterId:int}/churn")]
    [ProducesResponseType(typeof(DonorChurnScoreDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetChurn(int supporterId, CancellationToken cancellationToken = default)
    {
        try
        {
            var row = await ml.GetDonorByIdAsync(supporterId, cancellationToken);
            if (row is null)
                return NotFound();
            return Ok(row);
        }
        catch (FileNotFoundException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "ML donor data is not available.",
                Detail = ex.Message,
                Status = StatusCodes.Status503ServiceUnavailable,
            });
        }
    }
}
