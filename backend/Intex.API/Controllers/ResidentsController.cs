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
[Route("api/residents")]
public class ResidentsController(AppDbContext db, StaffScopeResolver scopeResolver) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(PagedResult<Resident>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<Resident>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] int? safehouseId = null,
        [FromQuery] string? caseStatus = null,
        [FromQuery] string? caseCategory = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        var query = scope.Apply(db.Residents.AsNoTracking().AsQueryable());
        if (safehouseId is { } sid)
            query = query.Where(r => r.SafehouseId == sid);
        if (!string.IsNullOrWhiteSpace(caseStatus))
            query = query.Where(r => r.CaseStatus == caseStatus);
        if (!string.IsNullOrWhiteSpace(caseCategory))
            query = query.Where(r => r.CaseCategory == caseCategory);
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(r =>
                (r.CaseControlNo != null && r.CaseControlNo.Contains(search)) ||
                (r.InternalCode != null && r.InternalCode.Contains(search)) ||
                (r.AssignedSocialWorker != null && r.AssignedSocialWorker.Contains(search)));

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
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        var entity = await scope.Apply(db.Residents.AsNoTracking().AsQueryable())
            .FirstOrDefaultAsync(r => r.ResidentId == id, cancellationToken);
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

    /// <summary>
    /// Full resident record (with safehouse) plus incident reports for admin review / drill-down.
    /// </summary>
    [HttpGet("{id:int}/detail")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(ResidentDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ResidentDetailResponse>> GetDetail(int id, CancellationToken cancellationToken)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        var resident = await scope.Apply(db.Residents.AsNoTracking().AsQueryable())
            .Include(r => r.Safehouse)
            .FirstOrDefaultAsync(r => r.ResidentId == id, cancellationToken);
        if (resident is null)
            return NotFound();

        var incidents = await db.IncidentReports.AsNoTracking()
            .Where(i => i.ResidentId == id)
            .OrderByDescending(i => i.IncidentDate)
            .Select(i => new IncidentReportListItemDto
            {
                IncidentId = i.IncidentId,
                SafehouseId = i.SafehouseId,
                IncidentDate = i.IncidentDate,
                IncidentType = i.IncidentType,
                Severity = i.Severity,
                Description = i.Description,
                ResponseTaken = i.ResponseTaken,
                Resolved = i.Resolved,
                ResolutionDate = i.ResolutionDate,
                ReportedBy = i.ReportedBy,
                FollowUpRequired = i.FollowUpRequired,
            })
            .ToListAsync(cancellationToken);

        return Ok(new ResidentDetailResponse { Resident = resident, Incidents = incidents });
    }
}

public sealed class ResidentDetailResponse
{
    public Resident Resident { get; set; } = null!;
    public List<IncidentReportListItemDto> Incidents { get; set; } = new();
}

public sealed class IncidentReportListItemDto
{
    public int IncidentId { get; set; }
    public int SafehouseId { get; set; }
    public DateTime? IncidentDate { get; set; }
    public string? IncidentType { get; set; }
    public string? Severity { get; set; }
    public string? Description { get; set; }
    public string? ResponseTaken { get; set; }
    public bool? Resolved { get; set; }
    public DateTime? ResolutionDate { get; set; }
    public string? ReportedBy { get; set; }
    public bool? FollowUpRequired { get; set; }
}
