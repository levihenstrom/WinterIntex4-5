using Intex.API.Contracts;
using Intex.API.Data;
using Intex.API.Extensions;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/process-recordings")]
public class ProcessRecordingsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(PagedResult<ProcessRecording>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ProcessRecording>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] int? residentId = null,
        [FromQuery] string? sessionType = null,
        [FromQuery] bool? progressNoted = null,
        [FromQuery] bool? concernsFlagged = null,
        [FromQuery] bool? referralMade = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var query = db.ProcessRecordings.AsNoTracking().AsQueryable();
        if (residentId is { } rid)
            query = query.Where(p => p.ResidentId == rid);
        if (!string.IsNullOrWhiteSpace(sessionType))
            query = query.Where(p => p.SessionType == sessionType);
        if (progressNoted is { } p)
            query = query.Where(r => r.ProgressNoted == p);
        if (concernsFlagged is { } c)
            query = query.Where(r => r.ConcernsFlagged == c);
        if (referralMade is { } r)
            query = query.Where(x => x.ReferralMade == r);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim();
            if (int.TryParse(q, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var ridFromSearch))
                query = query.Where(p => p.ResidentId == ridFromSearch);
            else
            {
                var needle = q.ToLower();
                query = query.Where(p =>
                    (p.SocialWorker != null && p.SocialWorker.ToLower().Contains(needle)) ||
                    (p.SessionType != null && p.SessionType.ToLower().Contains(needle)) ||
                    (p.SessionNarrative != null && p.SessionNarrative.ToLower().Contains(needle)));
            }
        }

        query = query.OrderByDescending(p => p.SessionDate).ThenBy(p => p.RecordingId);
        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(ProcessRecording), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProcessRecording>> GetById(int id, CancellationToken cancellationToken)
    {
        var entity = await db.ProcessRecordings.AsNoTracking().FirstOrDefaultAsync(p => p.RecordingId == id, cancellationToken);
        if (entity is null)
            return NotFound();
        return Ok(entity);
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(typeof(ProcessRecording), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProcessRecording>> Create([FromBody] ProcessRecording recording, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        recording.RecordingId = 0;
        db.ProcessRecordings.Add(recording);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = recording.RecordingId }, recording);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] ProcessRecording recording, CancellationToken cancellationToken)
    {
        if (id != recording.RecordingId)
            return BadRequest();
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        db.ProcessRecordings.Update(recording);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var entity = await db.ProcessRecordings.FindAsync([id], cancellationToken);
        if (entity is null)
            return NotFound();
        db.ProcessRecordings.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
