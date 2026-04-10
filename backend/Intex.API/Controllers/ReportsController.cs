using System.Text.Json.Serialization;
using Intex.API.Authorization;
using Intex.API.Data;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

/// <summary>
/// Aggregated analytics: giving trends, outcomes, services (caring/healing/teaching), and site comparisons.
/// Respects <see cref="StaffScopeResolver"/> the same way as list endpoints.
/// </summary>
[ApiController]
[Route("api/reports")]
public sealed class ReportsController(AppDbContext db, StaffScopeResolver scopeResolver) : ControllerBase
{
    [HttpGet("donation-trends")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(DonationTrendsReportDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DonationTrendsReportDto>> GetDonationTrends(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? safehouseId = null,
        [FromQuery] string? donationType = null,
        CancellationToken cancellationToken = default)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        var donationQuery = scope.Apply(db.Donations.AsNoTracking());

        if (from is { } f)
            donationQuery = donationQuery.Where(d => d.DonationDate >= f);
        if (to is { } t)
        {
            var end = t.Date.AddDays(1).AddTicks(-1);
            donationQuery = donationQuery.Where(d => d.DonationDate <= end);
        }

        if (!string.IsNullOrWhiteSpace(donationType))
            donationQuery = donationQuery.Where(d => d.DonationType == donationType);

        if (safehouseId is { } sid)
            donationQuery = donationQuery.Where(d =>
                d.DonationAllocations.Any(a => a.SafehouseId == sid));

        var donationsList = await donationQuery
            .Select(d => new
            {
                d.DonationId,
                d.DonationDate,
                d.DonationType,
                d.Amount,
                d.EstimatedValue,
                d.ImpactUnit,
                SupporterType = d.Supporter != null ? d.Supporter.SupporterType : null,
            })
            .ToListAsync(cancellationToken);

        var grandTotal = donationsList.Sum(d => FinancialContributionPhp(d.Amount, d.EstimatedValue, d.DonationType, d.ImpactUnit));
        var donationCount = donationsList.Count;

        var byMonth = donationsList
            .Where(d => d.DonationDate != null)
            .GroupBy(d => new DateTime(d.DonationDate!.Value.Year, d.DonationDate!.Value.Month, 1))
            .Select(g => new TimeSeriesPointDto
            {
                PeriodLabel = g.Key.ToString("yyyy-MM"),
                SortKey = g.Key,
                TotalAmount = g.Sum(x => FinancialContributionPhp(x.Amount, x.EstimatedValue, x.DonationType, x.ImpactUnit)),
                Count = g.Count(),
            })
            .OrderBy(x => x.SortKey)
            .Select(x => new TimeSeriesPointDto
            {
                PeriodLabel = x.PeriodLabel,
                SortKey = x.SortKey,
                TotalAmount = x.TotalAmount,
                Count = x.Count,
            })
            .ToList();

        var byTypeFinancial = donationsList
            .GroupBy(d => d.DonationType ?? "Unknown")
            .Select(g => new NamedAmountDto
            {
                Name = g.Key,
                Amount = g.Sum(x => FinancialContributionPhp(x.Amount, x.EstimatedValue, x.DonationType, x.ImpactUnit)),
                Count = g.Count(),
            })
            .Where(x => x.Amount > 0)
            .OrderByDescending(x => x.Amount)
            .ToList();

        var byTypeVolunteerHours = donationsList
            .GroupBy(d => d.DonationType ?? "Unknown")
            .Select(g => new NamedAmountDto
            {
                Name = g.Key,
                Amount = g.Sum(x => VolunteerHoursTotal(x.Amount, x.EstimatedValue, x.DonationType, x.ImpactUnit)),
                Count = g.Count(),
            })
            .Where(x => x.Amount > 0)
            .OrderByDescending(x => x.Amount)
            .ToList();

        var bySupporterFinancial = donationsList
            .GroupBy(d => d.SupporterType ?? "Unknown")
            .Select(g => new NamedAmountDto
            {
                Name = g.Key,
                Amount = g.Sum(x => FinancialContributionPhp(x.Amount, x.EstimatedValue, x.DonationType, x.ImpactUnit)),
                Count = g.Count(),
            })
            .Where(x => x.Amount > 0)
            .OrderByDescending(x => x.Amount)
            .ToList();

        var bySupporterVolunteerHours = donationsList
            .GroupBy(d => d.SupporterType ?? "Unknown")
            .Select(g => new NamedAmountDto
            {
                Name = g.Key,
                Amount = g.Sum(x => VolunteerHoursTotal(x.Amount, x.EstimatedValue, x.DonationType, x.ImpactUnit)),
                Count = g.Count(),
            })
            .Where(x => x.Amount > 0)
            .OrderByDescending(x => x.Amount)
            .ToList();

        var allocationQuery = db.DonationAllocations.AsNoTracking()
            .Where(a => donationQuery.Select(d => d.DonationId).Contains(a.DonationId));

        var byProgramArea = await allocationQuery
            .GroupBy(a => a.ProgramArea ?? "Unknown")
            .Select(g => new NamedAmountDto
            {
                Name = g.Key,
                Amount = g.Sum(a => a.AmountAllocated ?? 0m),
                Count = g.Count(),
            })
            .OrderByDescending(x => x.Amount)
            .ToListAsync(cancellationToken);

        var bySafehouse = await allocationQuery
            .GroupBy(a => a.SafehouseId)
            .Select(g => new SafehouseAmountDto
            {
                SafehouseId = g.Key,
                SafehouseName = g.Select(a => a.Safehouse.Name ?? a.Safehouse.SafehouseCode).FirstOrDefault() ?? $"#{g.Key}",
                Amount = g.Sum(a => a.AmountAllocated ?? 0m),
                AllocationCount = g.Count(),
            })
            .OrderByDescending(x => x.Amount)
            .ToListAsync(cancellationToken);

        var safehouses = await GetScopedSafehousesAsync(scope, cancellationToken);
        var donationTypes = await scope.Apply(db.Donations.AsNoTracking())
            .Where(d => d.DonationType != null && d.DonationType != "")
            .Select(d => d.DonationType!)
            .Distinct()
            .OrderBy(t => t)
            .ToListAsync(cancellationToken);

        return Ok(new DonationTrendsReportDto
        {
            GrandTotal = grandTotal,
            DonationCount = donationCount,
            ByMonth = byMonth,
            ByDonationTypeFinancial = byTypeFinancial,
            ByDonationTypeVolunteerHours = byTypeVolunteerHours,
            BySupporterTypeFinancial = bySupporterFinancial,
            BySupporterTypeVolunteerHours = bySupporterVolunteerHours,
            ByProgramArea = byProgramArea,
            BySafehouse = bySafehouse,
            FilterOptions = new ReportFilterOptionsDto
            {
                Safehouses = safehouses,
                DonationTypes = donationTypes,
            },
        });
    }

    [HttpGet("outcome-summary")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(OutcomeSummaryReportDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<OutcomeSummaryReportDto>> GetOutcomeSummary(
        [FromQuery] int? safehouseId = null,
        CancellationToken cancellationToken = default)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        var residentQuery = scope.Apply(db.Residents.AsNoTracking());
        if (safehouseId is { } sid)
            residentQuery = residentQuery.Where(r => r.SafehouseId == sid);

        var residentIds = await residentQuery.Select(r => r.ResidentId).ToListAsync(cancellationToken);
        var totalResidents = residentIds.Count;

        if (totalResidents == 0)
        {
            var emptySafehouses = await GetScopedSafehousesAsync(scope, cancellationToken);
            return Ok(new OutcomeSummaryReportDto
            {
                TotalResidents = 0,
                ActiveCases = 0,
                ClosedCases = 0,
                ReintegrationAttempted = 0,
                ReintegrationCompleted = 0,
                ReintegrationSuccessRate = null,
                Education = new EducationMetricsDto(),
                Health = new HealthMetricsDto(),
                AnnualAccomplishment = new AnnualAccomplishmentDto(),
                SafehouseRows = new List<SafehouseOutcomeRowDto>(),
                FilterOptions = new ReportFilterOptionsDto { Safehouses = emptySafehouses, DonationTypes = new List<string>() },
            });
        }

        var activeCases = await residentQuery.CountAsync(r => r.CaseStatus == "Active", cancellationToken);
        var closedCases = await residentQuery.CountAsync(r => r.CaseStatus == "Closed", cancellationToken);

        var withReint = residentQuery.Where(r =>
            r.ReintegrationStatus != null &&
            r.ReintegrationStatus != "");

        var reintegrationAttempted = await withReint.CountAsync(cancellationToken);
        // Use SQL-translatable comparison (EF cannot translate StringComparison.OrdinalIgnoreCase).
        var reintegrationCompleted = await withReint.CountAsync(r =>
            r.ReintegrationStatus != null &&
            r.ReintegrationStatus.ToLower() == "completed",
            cancellationToken);

        double? reintegrationRate = reintegrationAttempted > 0
            ? Math.Round(100.0 * reintegrationCompleted / reintegrationAttempted, 1)
            : null;

        var caringProcess = await db.ProcessRecordings.AsNoTracking()
            .CountAsync(p => residentIds.Contains(p.ResidentId), cancellationToken);
        var caringVisits = await db.HomeVisitations.AsNoTracking()
            .CountAsync(h => residentIds.Contains(h.ResidentId), cancellationToken);

        var teachingRecords = await db.EducationRecords.AsNoTracking()
            .CountAsync(e => residentIds.Contains(e.ResidentId), cancellationToken);

        var healingRecords = await db.HealthWellbeingRecords.AsNoTracking()
            .CountAsync(h => residentIds.Contains(h.ResidentId), cancellationToken);

        double? avgProgress = await db.EducationRecords.AsNoTracking()
            .Where(e => residentIds.Contains(e.ResidentId) && e.ProgressPercent != null)
            .Select(e => (double?)e.ProgressPercent)
            .AverageAsync(cancellationToken);

        double? avgHealth = await db.HealthWellbeingRecords.AsNoTracking()
            .Where(h => residentIds.Contains(h.ResidentId) && h.GeneralHealthScore != null)
            .Select(h => (double?)h.GeneralHealthScore)
            .AverageAsync(cancellationToken);

        var enrolled = await db.EducationRecords.AsNoTracking()
            .Where(e => residentIds.Contains(e.ResidentId) && e.EnrollmentStatus != null)
            .GroupBy(e => e.EnrollmentStatus!)
            .Select(g => new NamedCountDto { Name = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToListAsync(cancellationToken);

        var checkupTotal = await db.HealthWellbeingRecords.AsNoTracking()
            .CountAsync(h => residentIds.Contains(h.ResidentId), cancellationToken);
        var medicalDone = await db.HealthWellbeingRecords.AsNoTracking()
            .CountAsync(h => residentIds.Contains(h.ResidentId) && h.MedicalCheckupDone == true, cancellationToken);
        var dentalDone = await db.HealthWellbeingRecords.AsNoTracking()
            .CountAsync(h => residentIds.Contains(h.ResidentId) && h.DentalCheckupDone == true, cancellationToken);

        var safehouseRows = await residentQuery
            .GroupBy(r => new { r.SafehouseId, Name = r.Safehouse.Name ?? r.Safehouse.SafehouseCode })
            .Select(g => new
            {
                g.Key.SafehouseId,
                g.Key.Name,
                Residents = g.Count(),
                Completed = g.Count(r =>
                    r.ReintegrationStatus != null &&
                    r.ReintegrationStatus.ToLower() == "completed"),
                Attempted = g.Count(r =>
                    r.ReintegrationStatus != null &&
                    r.ReintegrationStatus != ""),
            })
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        var eduBySh = await db.EducationRecords.AsNoTracking()
            .Where(e => residentIds.Contains(e.ResidentId) && e.ProgressPercent != null)
            .Join(db.Residents.AsNoTracking(), e => e.ResidentId, r => r.ResidentId, (e, r) => new { r.SafehouseId, e.ProgressPercent })
            .GroupBy(x => x.SafehouseId)
            .Select(g => new { SafehouseId = g.Key, Avg = g.Average(x => (double)x.ProgressPercent!) })
            .ToListAsync(cancellationToken);

        var healthBySh = await db.HealthWellbeingRecords.AsNoTracking()
            .Where(h => residentIds.Contains(h.ResidentId) && h.GeneralHealthScore != null)
            .Join(db.Residents.AsNoTracking(), h => h.ResidentId, r => r.ResidentId, (h, r) => new { r.SafehouseId, h.GeneralHealthScore })
            .GroupBy(x => x.SafehouseId)
            .Select(g => new { SafehouseId = g.Key, Avg = g.Average(x => (double)x.GeneralHealthScore!) })
            .ToListAsync(cancellationToken);

        var rows = safehouseRows.Select(r =>
        {
            var eAvg = eduBySh.FirstOrDefault(x => x.SafehouseId == r.SafehouseId)?.Avg;
            var hAvg = healthBySh.FirstOrDefault(x => x.SafehouseId == r.SafehouseId)?.Avg;
            var rate = r.Attempted > 0 ? Math.Round(100.0 * r.Completed / r.Attempted, 1) : (double?)null;
            return new SafehouseOutcomeRowDto
            {
                SafehouseId = r.SafehouseId,
                SafehouseName = r.Name ?? $"#{r.SafehouseId}",
                ResidentCount = r.Residents,
                ReintegrationCompleted = r.Completed,
                ReintegrationAttempted = r.Attempted,
                ReintegrationSuccessRate = rate,
                AvgEducationProgressPercent = eAvg.HasValue ? Math.Round(eAvg.Value, 1) : null,
                AvgHealthScore = hAvg.HasValue ? Math.Round(hAvg.Value, 2) : null,
            };
        }).ToList();

        var safehouses = await GetScopedSafehousesAsync(scope, cancellationToken);

        return Ok(new OutcomeSummaryReportDto
        {
            TotalResidents = totalResidents,
            ActiveCases = activeCases,
            ClosedCases = closedCases,
            ReintegrationAttempted = reintegrationAttempted,
            ReintegrationCompleted = reintegrationCompleted,
            ReintegrationSuccessRate = reintegrationRate,
            Education = new EducationMetricsDto
            {
                EducationRecordCount = teachingRecords,
                AvgProgressPercent = avgProgress.HasValue ? Math.Round(avgProgress.Value, 1) : null,
                EnrollmentBreakdown = enrolled,
            },
            Health = new HealthMetricsDto
            {
                HealthRecordCount = healingRecords,
                AvgGeneralHealthScore = avgHealth.HasValue ? Math.Round(avgHealth.Value, 2) : null,
                MedicalCheckupRate = checkupTotal > 0 ? Math.Round(100.0 * medicalDone / checkupTotal, 1) : null,
                DentalCheckupRate = checkupTotal > 0 ? Math.Round(100.0 * dentalDone / checkupTotal, 1) : null,
            },
            AnnualAccomplishment = new AnnualAccomplishmentDto
            {
                Caring = new DomainServicesDto
                {
                    Label = "Caring (psychosocial & case support)",
                    ServiceUnits = caringProcess + caringVisits,
                    Detail = $"{caringProcess:N0} process recordings + {caringVisits:N0} home visits logged.",
                },
                Healing = new DomainServicesDto
                {
                    Label = "Healing (health & wellbeing)",
                    ServiceUnits = healingRecords,
                    Detail = healingRecords > 0
                        ? $"{healingRecords:N0} health & wellbeing records in this scope (see site table for averages)."
                        : "No health records in scope for the selected filter.",
                },
                Teaching = new DomainServicesDto
                {
                    Label = "Teaching (education & development)",
                    ServiceUnits = teachingRecords,
                    Detail = teachingRecords > 0
                        ? $"{teachingRecords:N0} education updates in this scope (see site table for learning progress)."
                        : "No education records in scope for the selected filter.",
                },
            },
            SafehouseRows = rows,
            FilterOptions = new ReportFilterOptionsDto
            {
                Safehouses = safehouses,
                DonationTypes = new List<string>(),
            },
        });
    }

    private async Task<List<SafehouseOptionDto>> GetScopedSafehousesAsync(StaffScope scope, CancellationToken ct)
    {
        var q = db.Safehouses.AsNoTracking().AsQueryable();
        if (!scope.IsAdmin)
        {
            if (scope.SafehouseIds.Count == 0)
                return new List<SafehouseOptionDto>();
            q = q.Where(s => scope.SafehouseIds.Contains(s.SafehouseId));
        }

        return await q
            .OrderBy(s => s.Name ?? s.SafehouseCode)
            .Select(s => new SafehouseOptionDto
            {
                SafehouseId = s.SafehouseId,
                Name = s.Name ?? s.SafehouseCode,
            })
            .ToListAsync(ct);
    }

    /// <summary>Volunteer time is stored in estimated value with types like Time/Skills or impact_unit hours — never mix with peso totals.</summary>
    private static bool IsVolunteerHoursDonation(string? donationType, string? impactUnit)
    {
        var t = (donationType ?? "").Trim();
        if (string.Equals(t, "Time", StringComparison.OrdinalIgnoreCase)) return true;
        if (string.Equals(t, "Skills", StringComparison.OrdinalIgnoreCase)) return true;
        var u = (impactUnit ?? "").Trim();
        return u.Contains("hour", StringComparison.OrdinalIgnoreCase);
    }

    private static decimal FinancialContributionPhp(decimal? amount, decimal? estimatedValue, string? donationType, string? impactUnit)
    {
        if (IsVolunteerHoursDonation(donationType, impactUnit)) return 0;
        if (string.Equals((donationType ?? "").Trim(), "SocialMedia", StringComparison.OrdinalIgnoreCase)) return 0;
        return amount ?? estimatedValue ?? 0m;
    }

    private static decimal VolunteerHoursTotal(decimal? amount, decimal? estimatedValue, string? donationType, string? impactUnit)
    {
        if (!IsVolunteerHoursDonation(donationType, impactUnit)) return 0;
        return estimatedValue ?? amount ?? 0m;
    }
}

public sealed class DonationTrendsReportDto
{
    public decimal GrandTotal { get; set; }
    public int DonationCount { get; set; }
    public List<TimeSeriesPointDto> ByMonth { get; set; } = new();
    public List<NamedAmountDto> ByDonationTypeFinancial { get; set; } = new();
    public List<NamedAmountDto> ByDonationTypeVolunteerHours { get; set; } = new();
    public List<NamedAmountDto> BySupporterTypeFinancial { get; set; } = new();
    public List<NamedAmountDto> BySupporterTypeVolunteerHours { get; set; } = new();
    public List<NamedAmountDto> ByProgramArea { get; set; } = new();
    public List<SafehouseAmountDto> BySafehouse { get; set; } = new();
    public ReportFilterOptionsDto FilterOptions { get; set; } = new();
}

public sealed class TimeSeriesPointDto
{
    public string PeriodLabel { get; set; } = "";
    [JsonIgnore]
    public DateTime SortKey { get; set; }
    public decimal TotalAmount { get; set; }
    public int Count { get; set; }
}

public sealed class NamedAmountDto
{
    public string Name { get; set; } = "";
    public decimal Amount { get; set; }
    public int Count { get; set; }
}

public sealed class SafehouseAmountDto
{
    public int SafehouseId { get; set; }
    public string SafehouseName { get; set; } = "";
    public decimal Amount { get; set; }
    public int AllocationCount { get; set; }
}

public sealed class ReportFilterOptionsDto
{
    public List<SafehouseOptionDto> Safehouses { get; set; } = new();
    public List<string> DonationTypes { get; set; } = new();
}

public sealed class SafehouseOptionDto
{
    public int SafehouseId { get; set; }
    public string Name { get; set; } = "";
}

public sealed class OutcomeSummaryReportDto
{
    public int TotalResidents { get; set; }
    public int ActiveCases { get; set; }
    public int ClosedCases { get; set; }
    public int ReintegrationAttempted { get; set; }
    public int ReintegrationCompleted { get; set; }
    public double? ReintegrationSuccessRate { get; set; }
    public EducationMetricsDto Education { get; set; } = new();
    public HealthMetricsDto Health { get; set; } = new();
    public AnnualAccomplishmentDto AnnualAccomplishment { get; set; } = new();
    public List<SafehouseOutcomeRowDto> SafehouseRows { get; set; } = new();
    public ReportFilterOptionsDto FilterOptions { get; set; } = new();
}

public sealed class EducationMetricsDto
{
    public int EducationRecordCount { get; set; }
    public double? AvgProgressPercent { get; set; }
    public List<NamedCountDto> EnrollmentBreakdown { get; set; } = new();
}

public sealed class HealthMetricsDto
{
    public int HealthRecordCount { get; set; }
    public double? AvgGeneralHealthScore { get; set; }
    public double? MedicalCheckupRate { get; set; }
    public double? DentalCheckupRate { get; set; }
}

public sealed class NamedCountDto
{
    public string Name { get; set; } = "";
    public int Count { get; set; }
}

public sealed class AnnualAccomplishmentDto
{
    public DomainServicesDto Caring { get; set; } = new();
    public DomainServicesDto Healing { get; set; } = new();
    public DomainServicesDto Teaching { get; set; } = new();
}

public sealed class DomainServicesDto
{
    public string Label { get; set; } = "";
    public int ServiceUnits { get; set; }
    public string Detail { get; set; } = "";
}

public sealed class SafehouseOutcomeRowDto
{
    public int SafehouseId { get; set; }
    public string SafehouseName { get; set; } = "";
    public int ResidentCount { get; set; }
    public int ReintegrationCompleted { get; set; }
    public int ReintegrationAttempted { get; set; }
    public double? ReintegrationSuccessRate { get; set; }
    public double? AvgEducationProgressPercent { get; set; }
    public double? AvgHealthScore { get; set; }
}
