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
        [FromQuery] string? reintegrationStatus = null,
        [FromQuery] string? currentRiskLevel = null,
        [FromQuery] bool? highRisk = null,
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
        if (!string.IsNullOrWhiteSpace(reintegrationStatus))
            query = query.Where(r => r.ReintegrationStatus == reintegrationStatus);
        if (!string.IsNullOrWhiteSpace(currentRiskLevel))
            query = query.Where(r => r.CurrentRiskLevel == currentRiskLevel);
        if (highRisk == true)
            query = query.Where(r => r.CurrentRiskLevel == "High" || r.CurrentRiskLevel == "Critical");
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            if (int.TryParse(s, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var rid))
                query = query.Where(r => r.ResidentId == rid);
            else
            {
                var needle = s.ToLower();
                query = query.Where(r =>
                    (r.CaseControlNo != null && r.CaseControlNo.ToLower().Contains(needle)) ||
                    (r.InternalCode != null && r.InternalCode.ToLower().Contains(needle)) ||
                    (r.AssignedSocialWorker != null && r.AssignedSocialWorker.ToLower().Contains(needle)));
            }
        }

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

        var educationRecords = await db.EducationRecords.AsNoTracking()
            .Where(e => e.ResidentId == id)
            .OrderByDescending(e => e.RecordDate)
            .Select(e => new EducationRecordDto
            {
                EducationRecordId = e.EducationRecordId,
                RecordDate = e.RecordDate,
                EducationLevel = e.EducationLevel,
                SchoolName = e.SchoolName,
                EnrollmentStatus = e.EnrollmentStatus,
                AttendanceRate = e.AttendanceRate,
                ProgressPercent = e.ProgressPercent,
                CompletionStatus = e.CompletionStatus,
                Notes = e.Notes,
            })
            .ToListAsync(cancellationToken);

        var healthRecords = await db.HealthWellbeingRecords.AsNoTracking()
            .Where(h => h.ResidentId == id)
            .OrderByDescending(h => h.RecordDate)
            .Select(h => new HealthRecordDto
            {
                HealthRecordId = h.HealthRecordId,
                RecordDate = h.RecordDate,
                GeneralHealthScore = h.GeneralHealthScore,
                NutritionScore = h.NutritionScore,
                SleepQualityScore = h.SleepQualityScore,
                EnergyLevelScore = h.EnergyLevelScore,
                HeightCm = h.HeightCm,
                WeightKg = h.WeightKg,
                Bmi = h.Bmi,
                MedicalCheckupDone = h.MedicalCheckupDone,
                DentalCheckupDone = h.DentalCheckupDone,
                PsychologicalCheckupDone = h.PsychologicalCheckupDone,
                Notes = h.Notes,
            })
            .ToListAsync(cancellationToken);

        var interventionPlans = await db.InterventionPlans.AsNoTracking()
            .Where(p => p.ResidentId == id)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new InterventionPlanDto
            {
                PlanId = p.PlanId,
                PlanCategory = p.PlanCategory,
                PlanDescription = p.PlanDescription,
                ServicesProvided = p.ServicesProvided,
                TargetValue = p.TargetValue,
                TargetDate = p.TargetDate,
                Status = p.Status,
                CaseConferenceDate = p.CaseConferenceDate,
                CreatedAt = p.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        return Ok(new ResidentDetailResponse
        {
            Resident = resident,
            Incidents = incidents,
            EducationRecords = educationRecords,
            HealthRecords = healthRecords,
            InterventionPlans = interventionPlans,
        });
    }
}

public sealed class ResidentDetailResponse
{
    public Resident Resident { get; set; } = null!;
    public List<IncidentReportListItemDto> Incidents { get; set; } = new();
    public List<EducationRecordDto> EducationRecords { get; set; } = new();
    public List<HealthRecordDto> HealthRecords { get; set; } = new();
    public List<InterventionPlanDto> InterventionPlans { get; set; } = new();
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

public sealed class EducationRecordDto
{
    public int EducationRecordId { get; set; }
    public DateTime? RecordDate { get; set; }
    public string? EducationLevel { get; set; }
    public string? SchoolName { get; set; }
    public string? EnrollmentStatus { get; set; }
    public decimal? AttendanceRate { get; set; }
    public decimal? ProgressPercent { get; set; }
    public string? CompletionStatus { get; set; }
    public string? Notes { get; set; }
}

public sealed class HealthRecordDto
{
    public int HealthRecordId { get; set; }
    public DateTime? RecordDate { get; set; }
    public decimal? GeneralHealthScore { get; set; }
    public decimal? NutritionScore { get; set; }
    public decimal? SleepQualityScore { get; set; }
    public decimal? EnergyLevelScore { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? Bmi { get; set; }
    public bool? MedicalCheckupDone { get; set; }
    public bool? DentalCheckupDone { get; set; }
    public bool? PsychologicalCheckupDone { get; set; }
    public string? Notes { get; set; }
}

public sealed class InterventionPlanDto
{
    public int PlanId { get; set; }
    public string? PlanCategory { get; set; }
    public string? PlanDescription { get; set; }
    public string? ServicesProvided { get; set; }
    public decimal? TargetValue { get; set; }
    public DateTime? TargetDate { get; set; }
    public string? Status { get; set; }
    public DateTime? CaseConferenceDate { get; set; }
    public DateTime? CreatedAt { get; set; }
}
