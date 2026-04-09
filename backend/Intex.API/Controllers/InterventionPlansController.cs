using Intex.API.Contracts;
using Intex.API.Data;
using Intex.API.Extensions;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/intervention-plans")]
public class InterventionPlansController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(PagedResult<InterventionPlan>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<InterventionPlan>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] int? residentId = null,
        CancellationToken cancellationToken = default)
    {
        var query = db.InterventionPlans.AsNoTracking().AsQueryable();
        if (residentId is { } rid)
            query = query.Where(p => p.ResidentId == rid);

        query = query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.PlanId);
        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(InterventionPlan), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InterventionPlan>> GetById(int id, CancellationToken cancellationToken)
    {
        var entity = await db.InterventionPlans.AsNoTracking().FirstOrDefaultAsync(p => p.PlanId == id, cancellationToken);
        if (entity is null)
            return NotFound();
        return Ok(entity);
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(typeof(InterventionPlan), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<InterventionPlan>> Create([FromBody] InterventionPlan plan, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        plan.PlanId = 0;
        plan.CreatedAt = DateTime.UtcNow;
        plan.UpdatedAt = DateTime.UtcNow;
        db.InterventionPlans.Add(plan);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = plan.PlanId }, plan);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] InterventionPlan plan, CancellationToken cancellationToken)
    {
        if (id != plan.PlanId)
            return BadRequest();
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        plan.UpdatedAt = DateTime.UtcNow;
        db.InterventionPlans.Update(plan);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var entity = await db.InterventionPlans.FindAsync([id], cancellationToken);
        if (entity is null)
            return NotFound();
        db.InterventionPlans.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
