using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Intex.API.Models;

[Table("intervention_plans")]
public class InterventionPlan
{
    [Key]
    [Column("plan_id")]
    public int PlanId { get; set; }

    [Column("resident_id")]
    [Range(1, int.MaxValue, ErrorMessage = "Resident is required.")]
    public int ResidentId { get; set; }

    public Resident Resident { get; set; } = null!;

    [Column("plan_category")]
    [Required(ErrorMessage = "Plan category is required.")]
    public string? PlanCategory { get; set; }

    [Column("plan_description")]
    public string? PlanDescription { get; set; }

    [Column("services_provided")]
    public string? ServicesProvided { get; set; }

    [Column("target_value")]
    public decimal? TargetValue { get; set; }

    [Column("target_date")]
    public DateTime? TargetDate { get; set; }

    [Column("status")]
    [Required(ErrorMessage = "Status is required.")]
    public string? Status { get; set; }

    [Column("case_conference_date")]
    public DateTime? CaseConferenceDate { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
