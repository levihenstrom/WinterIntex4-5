using System.Text.Json;
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

        if (rows.Count > 0)
            return Ok(rows);

        // No published snapshots exist — compute a live snapshot from the database so the
        // public landing and impact pages always show real data rather than hardcoded defaults.
        var totalResidents = await db.Residents.CountAsync(cancellationToken);
        var reintegrated = await db.Residents
            .CountAsync(r => r.ReintegrationStatus != null, cancellationToken);
        var safehousesActive = await db.Safehouses
            .CountAsync(s => s.Status == "Active", cancellationToken);
        if (safehousesActive == 0)
            safehousesActive = await db.Safehouses.CountAsync(cancellationToken);

        var oldestAdmission = await db.Residents
            .Where(r => r.DateOfAdmission != null)
            .MinAsync(r => (DateTime?)r.DateOfAdmission, cancellationToken);

        var reintegrationRate = totalResidents > 0
            ? Math.Round((double)reintegrated / totalResidents * 100, 1)
            : 0;

        var liveSnapshot = new PublicImpactSnapshot
        {
            SnapshotId = 0,
            SnapshotDate = DateTime.UtcNow,
            Headline = "Live Impact Data",
            SummaryText = "Current operational metrics computed from live records.",
            MetricPayloadJson = JsonSerializer.Serialize(new
            {
                residents_served = totalResidents,
                safehouses_active = safehousesActive,
                reintegration_rate_pct = reintegrationRate,
            }),
            IsPublished = true,
            PublishedAt = DateTime.UtcNow,
        };

        return Ok(new[] { liveSnapshot });
    }
}
