using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Intex.API.Models;

[Table("donation_allocations")]
public class DonationAllocation
{
    [Key]
    [Column("allocation_id")]
    public int AllocationId { get; set; }

    [Column("donation_id")]
    public int DonationId { get; set; }

    public Donation Donation { get; set; } = null!;

    [Column("safehouse_id")]
    public int SafehouseId { get; set; }

    public Safehouse Safehouse { get; set; } = null!;

    [Column("program_area")]
    public string? ProgramArea { get; set; }

    [Column("amount_allocated")]
    public decimal? AmountAllocated { get; set; }

    [Column("allocation_date")]
    public DateTime? AllocationDate { get; set; }

    [Column("allocation_notes")]
    public string? AllocationNotes { get; set; }
}
