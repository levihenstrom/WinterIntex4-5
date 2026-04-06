using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Intex.API.Models;

[Table("safehouse_monthly_metrics")]
public class SafehouseMonthlyMetric
{
    [Key]
    [Column("metric_id")]
    public int MetricId { get; set; }

    [Column("safehouse_id")]
    public int SafehouseId { get; set; }

    public Safehouse Safehouse { get; set; } = null!;

    [Column("month_start")]
    public DateTime? MonthStart { get; set; }

    [Column("month_end")]
    public DateTime? MonthEnd { get; set; }

    [Column("active_residents")]
    public int? ActiveResidents { get; set; }

    [Column("avg_education_progress")]
    public decimal? AvgEducationProgress { get; set; }

    [Column("avg_health_score")]
    public decimal? AvgHealthScore { get; set; }

    [Column("process_recording_count")]
    public int? ProcessRecordingCount { get; set; }

    [Column("home_visitation_count")]
    public int? HomeVisitationCount { get; set; }

    [Column("incident_count")]
    public int? IncidentCount { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }
}
