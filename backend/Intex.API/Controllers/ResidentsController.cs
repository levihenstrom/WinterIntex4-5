using Intex.API.Contracts;
using Intex.API.Data;
using Intex.API.Extensions;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/residents")]
public class ResidentsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(PagedResult<Resident>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<Resident>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] int? safehouseId = null,
        [FromQuery] string? caseStatus = null,
        CancellationToken cancellationToken = default)
    {
        var query = db.Residents.AsNoTracking().AsQueryable();
        if (safehouseId is { } sid)
            query = query.Where(r => r.SafehouseId == sid);
        if (!string.IsNullOrWhiteSpace(caseStatus))
            query = query.Where(r => r.CaseStatus == caseStatus);

        query = query.OrderBy(r => r.ResidentId);
        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(Resident), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Resident>> GetById(int id, CancellationToken cancellationToken)
    {
        var entity = await db.Residents.AsNoTracking().FirstOrDefaultAsync(r => r.ResidentId == id, cancellationToken);
        if (entity is null)
            return NotFound();
        return Ok(entity);
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(typeof(Resident), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<Resident>> Create([FromBody] Resident resident, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        resident.ResidentId = 0;
        db.Residents.Add(resident);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = resident.ResidentId }, resident);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] Resident resident, CancellationToken cancellationToken)
    {
        if (id != resident.ResidentId)
            return BadRequest();
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        db.Residents.Update(resident);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var entity = await db.Residents.FindAsync([id], cancellationToken);
        if (entity is null)
            return NotFound();
        db.Residents.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
