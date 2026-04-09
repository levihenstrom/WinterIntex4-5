using Intex.API.Authorization;
using Intex.API.Contracts;
using Intex.API.Data;
using Intex.API.Extensions;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/donation-allocations")]
public class DonationAllocationsController(AppDbContext db, StaffScopeResolver scopeResolver) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(PagedResult<DonationAllocation>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<DonationAllocation>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] int? safehouseId = null,
        [FromQuery] string? programArea = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);

        var query = db.DonationAllocations.AsNoTracking()
            .Include(a => a.Safehouse)
            .Include(a => a.Donation)
            .ThenInclude(d => d.Supporter)
            .AsQueryable();

        // Staff scope: restrict to safehouses in the user's partner assignments.
        if (!scope.IsAdmin)
        {
            if (scope.SafehouseIds.Count == 0)
            {
                query = query.Where(_ => false);
            }
            else
            {
                query = query.Where(a => scope.SafehouseIds.Contains(a.SafehouseId));
            }
        }

        if (safehouseId is { } sid)
            query = query.Where(a => a.SafehouseId == sid);
        if (!string.IsNullOrWhiteSpace(programArea))
            query = query.Where(a => a.ProgramArea == programArea);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim();
            if (int.TryParse(q, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var donationId))
            {
                query = query.Where(a => a.DonationId == donationId);
            }
            else
            {
                var needle = q.ToLower();
                query = query.Where(a =>
                    (a.ProgramArea != null && a.ProgramArea.ToLower().Contains(needle)) ||
                    (a.AllocationNotes != null && a.AllocationNotes.ToLower().Contains(needle)) ||
                    (a.Safehouse != null && a.Safehouse.Name != null && a.Safehouse.Name.ToLower().Contains(needle)) ||
                    (a.Donation != null && a.Donation.Supporter != null && a.Donation.Supporter.DisplayName != null && a.Donation.Supporter.DisplayName.ToLower().Contains(needle)));
            }
        }

        query = query
            .OrderByDescending(a => a.AllocationDate)
            .ThenBy(a => a.AllocationId);

        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("summary")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(IReadOnlyList<DonationAllocationSummary>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DonationAllocationSummary>>> GetSummary(
        CancellationToken cancellationToken)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);

        var query = db.DonationAllocations.AsNoTracking().AsQueryable();
        if (!scope.IsAdmin)
        {
            if (scope.SafehouseIds.Count == 0)
                return Ok(Array.Empty<DonationAllocationSummary>());
            query = query.Where(a => scope.SafehouseIds.Contains(a.SafehouseId));
        }

        var summary = await query
            .GroupBy(a => new { a.SafehouseId, a.ProgramArea })
            .Select(g => new DonationAllocationSummary
            {
                SafehouseId = g.Key.SafehouseId,
                ProgramArea = g.Key.ProgramArea,
                AllocationCount = g.Count(),
                TotalAllocated = g.Sum(a => a.AmountAllocated ?? 0m)
            })
            .OrderBy(s => s.SafehouseId)
            .ThenBy(s => s.ProgramArea)
            .ToListAsync(cancellationToken);

        return Ok(summary);
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(typeof(DonationAllocation), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DonationAllocation>> Create(
        [FromBody] DonationAllocation allocation,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        allocation.AllocationId = 0;
        db.DonationAllocations.Add(allocation);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetPage), new { }, allocation);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(typeof(DonationAllocation), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DonationAllocation>> Update(
        int id,
        [FromBody] DonationAllocation body,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var existing = await db.DonationAllocations.FindAsync([id], cancellationToken);
        if (existing is null)
            return NotFound();

        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        if (!scope.IsAdmin && !scope.SafehouseIds.Contains(existing.SafehouseId))
            return Forbid();

        existing.SafehouseId = body.SafehouseId;
        existing.DonationId = body.DonationId;
        existing.ProgramArea = body.ProgramArea;
        existing.AmountAllocated = body.AmountAllocated;
        existing.AllocationDate = body.AllocationDate;
        existing.AllocationNotes = body.AllocationNotes;

        await db.SaveChangesAsync(cancellationToken);
        return Ok(existing);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var existing = await db.DonationAllocations.FindAsync([id], cancellationToken);
        if (existing is null)
            return NotFound();

        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        if (!scope.IsAdmin && !scope.SafehouseIds.Contains(existing.SafehouseId))
            return Forbid();

        db.DonationAllocations.Remove(existing);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

public sealed class DonationAllocationSummary
{
    public int SafehouseId { get; set; }
    public string? ProgramArea { get; set; }
    public int AllocationCount { get; set; }
    public decimal TotalAllocated { get; set; }
}
