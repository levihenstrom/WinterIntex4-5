using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Intex.API.Models;

[Table("partner_assignments")]
public class PartnerAssignment
{
    [Key]
    [Column("assignment_id")]
    public int AssignmentId { get; set; }

    [Column("partner_id")]
    public int PartnerId { get; set; }

    public Partner Partner { get; set; } = null!;

    [Column("safehouse_id")]
    public int? SafehouseId { get; set; }

    public Safehouse? Safehouse { get; set; }

    [Column("program_area")]
    public string? ProgramArea { get; set; }

    [Column("assignment_start")]
    public DateTime? AssignmentStart { get; set; }

    [Column("assignment_end")]
    public DateTime? AssignmentEnd { get; set; }

    [Column("responsibility_notes")]
    public string? ResponsibilityNotes { get; set; }

    [Column("is_primary")]
    public bool IsPrimary { get; set; }

    [Column("status")]
    public string? Status { get; set; }
}
