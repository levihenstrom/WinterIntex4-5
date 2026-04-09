using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace Intex.API.Models;

[Table("home_visitations")]
public class HomeVisitation
{
    [Key]
    [Column("visitation_id")]
    public int VisitationId { get; set; }

    [Column("resident_id")]
    [Range(1, int.MaxValue, ErrorMessage = "Resident is required.")]
    public int ResidentId { get; set; }

    [ValidateNever]
    public Resident? Resident { get; set; }

    [Column("visit_date")]
    [Required(ErrorMessage = "Visit date is required.")]
    public DateTime? VisitDate { get; set; }

    [Column("social_worker")]
    [Required(ErrorMessage = "Social worker is required.")]
    public string? SocialWorker { get; set; }

    [Column("visit_type")]
    [Required(ErrorMessage = "Visit type is required.")]
    public string? VisitType { get; set; }

    [Column("location_visited")]
    public string? LocationVisited { get; set; }

    [Column("family_members_present")]
    public string? FamilyMembersPresent { get; set; }

    [Column("purpose")]
    public string? Purpose { get; set; }

    [Column("observations")]
    public string? Observations { get; set; }

    [Column("family_cooperation_level")]
    public string? FamilyCooperationLevel { get; set; }

    [Column("safety_concerns_noted")]
    public bool? SafetyConcernsNoted { get; set; }

    [Column("follow_up_needed")]
    public bool? FollowUpNeeded { get; set; }

    [Column("follow_up_notes")]
    public string? FollowUpNotes { get; set; }

    [Column("visit_outcome")]
    public string? VisitOutcome { get; set; }
}
