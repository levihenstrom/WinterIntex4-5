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
}

public sealed class DonationAllocationSummary
{
    public int SafehouseId { get; set; }
    public string? ProgramArea { get; set; }
    public int AllocationCount { get; set; }
    public decimal TotalAllocated { get; set; }
}
