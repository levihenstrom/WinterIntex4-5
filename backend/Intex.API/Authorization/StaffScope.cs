using System.Security.Claims;
using Intex.API.Data;
using Intex.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Authorization;

/// <summary>
/// Resolves which safehouses a user is authorized to see, based on their
/// linked partner's active assignments.
///
/// Admins short-circuit to IsAdmin=true (no filter downstream).
/// Staff users are scoped via a "partnerId" claim → PartnerAssignments where
/// status='Active' AND safehouse_id IS NOT NULL AND assignment_end is in the future (or null).
/// Program-only assignments (NULL safehouse_id) are intentionally ignored.
/// </summary>
public sealed class StaffScopeResolver(AppDbContext db)
{
    public const string PartnerIdClaimType = "partnerId";
    public const string SupporterIdClaimType = "supporterId";

    public async Task<StaffScope> GetForUserAsync(ClaimsPrincipal user, CancellationToken ct = default)
    {
        var isAdmin = user.IsInRole(AuthRoles.Admin);
        if (isAdmin)
            return new StaffScope(IsAdmin: true, SafehouseIds: new HashSet<int>());

        var partnerIdClaim = user.FindFirstValue(PartnerIdClaimType);
        if (!int.TryParse(partnerIdClaim, out var partnerId))
            return new StaffScope(IsAdmin: false, SafehouseIds: new HashSet<int>());

        var today = DateTime.UtcNow.Date;

        var safehouseIds = await db.PartnerAssignments
            .AsNoTracking()
            .Where(pa => pa.PartnerId == partnerId)
            .Where(pa => pa.Status == "Active")
            .Where(pa => pa.SafehouseId != null)
            .Where(pa => pa.AssignmentEnd == null || pa.AssignmentEnd >= today)
            .Select(pa => pa.SafehouseId!.Value)
            .Distinct()
            .ToListAsync(ct);

        return new StaffScope(IsAdmin: false, SafehouseIds: safehouseIds.ToHashSet());
    }
}

public sealed record StaffScope(bool IsAdmin, HashSet<int> SafehouseIds)
{
    public IQueryable<Resident> Apply(IQueryable<Resident> query)
    {
        if (IsAdmin) return query;
        if (SafehouseIds.Count == 0) return query.Where(_ => false);
        return query.Where(r => SafehouseIds.Contains(r.SafehouseId));
    }

    public IQueryable<Donation> Apply(IQueryable<Donation> query)
    {
        if (IsAdmin) return query;
        if (SafehouseIds.Count == 0) return query.Where(_ => false);
        return query.Where(d => d.DonationAllocations
            .Any(a => SafehouseIds.Contains(a.SafehouseId)));
    }

    public IQueryable<Supporter> Apply(IQueryable<Supporter> query)
    {
        if (IsAdmin) return query;
        if (SafehouseIds.Count == 0) return query.Where(_ => false);
        return query.Where(s => s.Donations
            .Any(d => d.DonationAllocations
                .Any(a => SafehouseIds.Contains(a.SafehouseId))));
    }
}
