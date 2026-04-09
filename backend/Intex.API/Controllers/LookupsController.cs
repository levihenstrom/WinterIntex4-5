using Intex.API.Authorization;
using Intex.API.Data;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/lookups")]
[Authorize(Policy = AuthPolicies.StaffRead)]
public sealed class LookupsController(AppDbContext db, StaffScopeResolver scopeResolver) : ControllerBase
{
    /// <summary>Safehouses visible to the current user (all for admin, assigned sites for staff).</summary>
    [HttpGet("safehouses")]
    [ProducesResponseType(typeof(IReadOnlyList<SafehouseLookupDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SafehouseLookupDto>>> GetSafehouses(CancellationToken cancellationToken)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        var q = db.Safehouses.AsNoTracking().AsQueryable();
        if (!scope.IsAdmin)
        {
            if (scope.SafehouseIds.Count == 0)
                return Ok(Array.Empty<SafehouseLookupDto>());
            q = q.Where(s => scope.SafehouseIds.Contains(s.SafehouseId));
        }

        var rows = await q
            .OrderBy(s => s.Name ?? s.SafehouseCode)
            .Select(s => new SafehouseLookupDto(
                s.SafehouseId,
                s.Name ?? s.SafehouseCode,
                s.SafehouseCode))
            .ToListAsync(cancellationToken);
        return Ok(rows);
    }

    /// <summary>
    /// Distinct social worker names already used on residents, sessions, or visits (scoped to visible residents).
    /// </summary>
    [HttpGet("social-workers")]
    [ProducesResponseType(typeof(IReadOnlyList<string>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<string>>> GetSocialWorkers(
        [FromQuery] string? q = null,
        CancellationToken cancellationToken = default)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        if (!scope.IsAdmin && scope.SafehouseIds.Count == 0)
            return Ok(Array.Empty<string>());

        var scopedResidents = scope.Apply(db.Residents.AsNoTracking());
        var residentIdQuery = scopedResidents.Select(r => r.ResidentId);

        var fromResidents = await scopedResidents
            .Where(r => r.AssignedSocialWorker != null && r.AssignedSocialWorker.Trim() != "")
            .Select(r => r.AssignedSocialWorker!.Trim())
            .ToListAsync(cancellationToken);

        var fromSessions = await db.ProcessRecordings.AsNoTracking()
            .Where(p => residentIdQuery.Contains(p.ResidentId))
            .Where(p => p.SocialWorker != null && p.SocialWorker.Trim() != "")
            .Select(p => p.SocialWorker!.Trim())
            .ToListAsync(cancellationToken);

        var fromVisits = await db.HomeVisitations.AsNoTracking()
            .Where(h => residentIdQuery.Contains(h.ResidentId))
            .Where(h => h.SocialWorker != null && h.SocialWorker.Trim() != "")
            .Select(h => h.SocialWorker!.Trim())
            .ToListAsync(cancellationToken);

        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var s in fromResidents) set.Add(s);
        foreach (var s in fromSessions) set.Add(s);
        foreach (var s in fromVisits) set.Add(s);

        IEnumerable<string> list = set.OrderBy(x => x);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var qq = q.Trim();
            list = list.Where(x => x.Contains(qq, StringComparison.OrdinalIgnoreCase));
        }

        return Ok(list.Take(150).ToList());
    }
}

public sealed record SafehouseLookupDto(int SafehouseId, string DisplayName, string SafehouseCode);
