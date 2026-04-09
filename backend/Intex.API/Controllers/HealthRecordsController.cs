using Intex.API.Contracts;
using Intex.API.Data;
using Intex.API.Extensions;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/health-records")]
public class HealthRecordsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(PagedResult<HealthWellbeingRecord>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<HealthWellbeingRecord>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] int? residentId = null,
        CancellationToken cancellationToken = default)
    {
        var query = db.HealthWellbeingRecords.AsNoTracking().AsQueryable();
        if (residentId is { } rid)
            query = query.Where(h => h.ResidentId == rid);

        query = query.OrderByDescending(h => h.RecordDate).ThenBy(h => h.HealthRecordId);
        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(HealthWellbeingRecord), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HealthWellbeingRecord>> GetById(int id, CancellationToken cancellationToken)
    {
        var entity = await db.HealthWellbeingRecords.AsNoTracking().FirstOrDefaultAsync(h => h.HealthRecordId == id, cancellationToken);
        if (entity is null)
            return NotFound();
        return Ok(entity);
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(typeof(HealthWellbeingRecord), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<HealthWellbeingRecord>> Create([FromBody] HealthWellbeingRecord record, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        record.HealthRecordId = 0;
        db.HealthWellbeingRecords.Add(record);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = record.HealthRecordId }, record);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] HealthWellbeingRecord record, CancellationToken cancellationToken)
    {
        if (id != record.HealthRecordId)
            return BadRequest();
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        db.HealthWellbeingRecords.Update(record);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var entity = await db.HealthWellbeingRecords.FindAsync([id], cancellationToken);
        if (entity is null)
            return NotFound();
        db.HealthWellbeingRecords.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
