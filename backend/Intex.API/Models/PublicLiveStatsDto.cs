namespace Intex.API.Models;

/// <summary>
/// Anonymized, unauthenticated-safe aggregate stats computed live from the database.
/// Returned by GET /api/public-impact/live-stats.
/// </summary>
public record PublicLiveStatsDto(
    int TotalResidents,
    int SuccessfulReintegrations,
    int SafehousesActive,
    decimal DonationsRaisedTotal,
    int VolunteerHoursTotal,
    double ReintegrationRatePct,
    int? OldestAdmissionYear,
    double? AvgHealthScore,
    double? AvgEducationProgress
);
