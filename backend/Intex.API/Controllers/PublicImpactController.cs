using Intex.API.Data;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

/// <summary>
/// Published, anonymized impact snapshots for the public /impact dashboard.
/// </summary>
[ApiController]
[Route("api/public-impact")]
public sealed class PublicImpactController(AppDbContext db) : ControllerBase
{
    [HttpGet("snapshots")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<PublicImpactSnapshot>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PublicImpactSnapshot>>> GetPublishedSnapshots(
        CancellationToken cancellationToken)
    {
        var rows = await db.PublicImpactSnapshots.AsNoTracking()
            .Where(s => s.IsPublished == true)
            .OrderByDescending(s => s.SnapshotDate)
            .ThenByDescending(s => s.SnapshotId)
            .Take(48)
            .ToListAsync(cancellationToken);

        return Ok(rows);
    }
}
