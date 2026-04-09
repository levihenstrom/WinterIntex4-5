using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace Intex.API.Models;

[Table("process_recordings")]
public class ProcessRecording
{
    [Key]
    [Column("recording_id")]
    public int RecordingId { get; set; }

    [Column("resident_id")]
    [Range(1, int.MaxValue, ErrorMessage = "Resident is required.")]
    public int ResidentId { get; set; }

    [ValidateNever]
    public Resident? Resident { get; set; }

    [Column("session_date")]
    [Required(ErrorMessage = "Session date is required.")]
    public DateTime? SessionDate { get; set; }

    [Column("social_worker")]
    [Required(ErrorMessage = "Social worker is required.")]
    public string? SocialWorker { get; set; }

    [Column("session_type")]
    [Required(ErrorMessage = "Session type is required.")]
    public string? SessionType { get; set; }

    [Column("session_duration_minutes")]
    public int? SessionDurationMinutes { get; set; }

    [Column("emotional_state_observed")]
    public string? EmotionalStateObserved { get; set; }

    [Column("emotional_state_end")]
    public string? EmotionalStateEnd { get; set; }

    [Column("session_narrative")]
    public string? SessionNarrative { get; set; }

    [Column("interventions_applied")]
    public string? InterventionsApplied { get; set; }

    [Column("follow_up_actions")]
    public string? FollowUpActions { get; set; }

    [Column("progress_noted")]
    public bool? ProgressNoted { get; set; }

    [Column("concerns_flagged")]
    public bool? ConcernsFlagged { get; set; }

    [Column("referral_made")]
    public bool? ReferralMade { get; set; }

    [Column("notes_restricted")]
    public string? NotesRestricted { get; set; }
}
