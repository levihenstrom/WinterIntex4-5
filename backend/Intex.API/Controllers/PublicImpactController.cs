using System.Text.Json;
using Intex.API.Data;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

/// <summary>
/// Published, anonymized impact snapshots for the public /impact dashboard.
/// </summary>
[ApiController]
[Route("api/public-impact")]
public sealed class PublicImpactController(AppDbContext db) : ControllerBase
{
    [HttpGet("snapshots")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<PublicImpactSnapshot>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PublicImpactSnapshot>>> GetPublishedSnapshots(
        CancellationToken cancellationToken)
    {
        var rows = await db.PublicImpactSnapshots.AsNoTracking()
            .Where(s => s.IsPublished == true)
            .OrderByDescending(s => s.SnapshotDate)
            .ThenByDescending(s => s.SnapshotId)
            .Take(48)
            .ToListAsync(cancellationToken);

        if (rows.Count > 0)
        {
            // Enrich snapshots that have zero health/education (common when snapshots were
            // generated without those computed fields). The latest snapshot gets live values;
            // older ones keep whatever was stored.
            var liveAvgHealth = await db.HealthWellbeingRecords
                .Where(h => h.GeneralHealthScore != null)
                .AverageAsync(h => (double?)h.GeneralHealthScore, cancellationToken);
            var liveAvgEdu = await db.EducationRecords
                .Where(e => e.ProgressPercent != null)
                .AverageAsync(e => (double?)e.ProgressPercent, cancellationToken);
            var liveDonations = (await db.Donations
                .SumAsync(d => (decimal?)d.Amount, cancellationToken)) ?? 0m;

            var enriched = rows.Select((snap, idx) =>
            {
                try
                {
                    var payload = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
                        snap.MetricPayloadJson ?? "{}") ?? new();

                    bool healthZero = !payload.ContainsKey("avg_health_score")
                        || payload["avg_health_score"].GetDouble() == 0;
                    bool eduZero = !payload.ContainsKey("avg_education_progress")
                        || payload["avg_education_progress"].GetDouble() == 0;
                    bool donZero = !payload.ContainsKey("donations_total_for_month")
                        || payload["donations_total_for_month"].GetDecimal() == 0;

                    if (healthZero || eduZero || donZero)
                    {
                        if (healthZero && liveAvgHealth.HasValue)
                            payload["avg_health_score"] = JsonSerializer.SerializeToElement(Math.Round(liveAvgHealth.Value, 2));
                        if (eduZero && liveAvgEdu.HasValue)
                            payload["avg_education_progress"] = JsonSerializer.SerializeToElement(Math.Round(liveAvgEdu.Value, 1));
                        if (donZero && idx == 0)
                            payload["donations_total_for_month"] = JsonSerializer.SerializeToElement(liveDonations);

                        // Also ensure total_residents key is present
                        if (!payload.ContainsKey("total_residents") && payload.ContainsKey("residents_served"))
                            payload["total_residents"] = payload["residents_served"];

                        snap.MetricPayloadJson = JsonSerializer.Serialize(payload);
                    }
                }
                catch { /* leave snapshot as-is if payload is malformed */ }

                return snap;
            }).ToList();

            return Ok(enriched);
        }

        // No published snapshots exist — compute a live snapshot from the database so the
        // public landing and impact pages always show real data rather than hardcoded defaults.
        var totalResidents = await db.Residents.CountAsync(cancellationToken);
        var reintegrated = await db.Residents
            .CountAsync(r => r.ReintegrationStatus == "Completed", cancellationToken);
        var safehousesActive = await db.Safehouses
            .CountAsync(s => s.Status == "Active", cancellationToken);
        if (safehousesActive == 0)
            safehousesActive = await db.Safehouses.CountAsync(cancellationToken);

        var oldestAdmission = await db.Residents
            .Where(r => r.DateOfAdmission != null)
            .MinAsync(r => (DateTime?)r.DateOfAdmission, cancellationToken);

        var reintegrationRate = totalResidents > 0
            ? Math.Round((double)reintegrated / totalResidents * 100, 1)
            : 0;

        var liveAvgHealth = await db.HealthWellbeingRecords
            .Where(h => h.GeneralHealthScore != null)
            .AverageAsync(h => (double?)h.GeneralHealthScore, cancellationToken);

        var liveAvgEdu = await db.EducationRecords
            .Where(e => e.ProgressPercent != null)
            .AverageAsync(e => (double?)e.ProgressPercent, cancellationToken);

        var liveDonations = (await db.Donations
            .SumAsync(d => (decimal?)d.Amount, cancellationToken)) ?? 0m;

        var liveSnapshot = new PublicImpactSnapshot
        {
            SnapshotId = 0,
            SnapshotDate = DateTime.UtcNow,
            Headline = $"Lighthouse Sanctuary Impact Update – {DateTime.UtcNow:MMMM yyyy}",
            SummaryText = $"Anonymized aggregate report: {totalResidents} residents active, average health score {(liveAvgHealth.HasValue ? liveAvgHealth.Value.ToString("0.##") : "0")}, average education progress {(liveAvgEdu.HasValue ? liveAvgEdu.Value.ToString("0.#") : "0")}%.",
            MetricPayloadJson = JsonSerializer.Serialize(new
            {
                total_residents = totalResidents,
                residents_served = totalResidents,
                safehouses_active = safehousesActive,
                reintegration_rate_pct = reintegrationRate,
                avg_health_score = liveAvgHealth.HasValue ? Math.Round(liveAvgHealth.Value, 2) : 0,
                avg_education_progress = liveAvgEdu.HasValue ? Math.Round(liveAvgEdu.Value, 1) : 0,
                donations_total_for_month = liveDonations,
            }),
            IsPublished = true,
            PublishedAt = DateTime.UtcNow,
        };

        return Ok(new[] { liveSnapshot });
    }

    /// <summary>
    /// Live aggregate KPIs computed directly from the database — no snapshot publishing required.
    /// Safe for unauthenticated callers: only anonymized totals are returned.
    /// </summary>
    [HttpGet("live-stats")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PublicLiveStatsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PublicLiveStatsDto>> GetLiveStats(CancellationToken cancellationToken)
    {
        var totalResidents = await db.Residents.CountAsync(cancellationToken);

        // Only "Completed" reintegration_status counts as a successful reintegration.
        // "Closed" cases may be administrative closures; "Transferred" means moved to another facility.
        var reintegrated = await db.Residents
            .CountAsync(r => r.ReintegrationStatus == "Completed", cancellationToken);

        var safehousesActive = await db.Safehouses
            .CountAsync(s => s.Status == "Active", cancellationToken);
        if (safehousesActive == 0)
            safehousesActive = await db.Safehouses.CountAsync(cancellationToken);

        // Sum all recorded donation amounts regardless of currency (public-facing total).
        var donationsTotal = (await db.Donations
            .SumAsync(d => (decimal?)d.Amount, cancellationToken)) ?? 0m;

        // Use session duration as a proxy for staff/volunteer hours.
        var sessionMinutes = (await db.ProcessRecordings
            .SumAsync(p => (int?)p.SessionDurationMinutes, cancellationToken)) ?? 0;
        var volunteerHours = sessionMinutes / 60;

        var reintegrationRate = totalResidents > 0
            ? Math.Round((double)reintegrated / totalResidents * 100, 1)
            : 0;

        var oldestAdmission = await db.Residents
            .Where(r => r.DateOfAdmission != null)
            .MinAsync(r => (DateTime?)r.DateOfAdmission, cancellationToken);

        var avgHealthRaw = await db.HealthWellbeingRecords
            .Where(h => h.GeneralHealthScore != null)
            .AverageAsync(h => (double?)h.GeneralHealthScore, cancellationToken);

        var avgEducationRaw = await db.EducationRecords
            .Where(e => e.ProgressPercent != null)
            .AverageAsync(e => (double?)e.ProgressPercent, cancellationToken);

        return Ok(new PublicLiveStatsDto(
            TotalResidents: totalResidents,
            SuccessfulReintegrations: reintegrated,
            SafehousesActive: safehousesActive,
            DonationsRaisedTotal: donationsTotal,
            VolunteerHoursTotal: volunteerHours,
            ReintegrationRatePct: reintegrationRate,
            OldestAdmissionYear: oldestAdmission?.Year,
            AvgHealthScore: avgHealthRaw.HasValue ? Math.Round(avgHealthRaw.Value, 2) : null,
            AvgEducationProgress: avgEducationRaw.HasValue ? Math.Round(avgEducationRaw.Value, 1) : null
        ));
    }
}
