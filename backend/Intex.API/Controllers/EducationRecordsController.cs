using Intex.API.Contracts;
using Intex.API.Data;
using Intex.API.Extensions;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/education-records")]
public class EducationRecordsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(PagedResult<EducationRecord>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<EducationRecord>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] int? residentId = null,
        CancellationToken cancellationToken = default)
    {
        var query = db.EducationRecords.AsNoTracking().AsQueryable();
        if (residentId is { } rid)
            query = query.Where(e => e.ResidentId == rid);

        query = query.OrderByDescending(e => e.RecordDate).ThenBy(e => e.EducationRecordId);
        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(EducationRecord), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EducationRecord>> GetById(int id, CancellationToken cancellationToken)
    {
        var entity = await db.EducationRecords.AsNoTracking().FirstOrDefaultAsync(e => e.EducationRecordId == id, cancellationToken);
        if (entity is null)
            return NotFound();
        return Ok(entity);
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(typeof(EducationRecord), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<EducationRecord>> Create([FromBody] EducationRecord record, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        record.EducationRecordId = 0;
        db.EducationRecords.Add(record);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = record.EducationRecordId }, record);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] EducationRecord record, CancellationToken cancellationToken)
    {
        if (id != record.EducationRecordId)
            return BadRequest();
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        db.EducationRecords.Update(record);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var entity = await db.EducationRecords.FindAsync([id], cancellationToken);
        if (entity is null)
            return NotFound();
        db.EducationRecords.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
