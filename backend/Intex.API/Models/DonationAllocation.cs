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
    [Range(1, int.MaxValue, ErrorMessage = "Donation is required.")]
    public int DonationId { get; set; }

    public Donation Donation { get; set; } = null!;

    [Column("safehouse_id")]
    [Range(1, int.MaxValue, ErrorMessage = "Safehouse is required.")]
    public int SafehouseId { get; set; }

    public Safehouse Safehouse { get; set; } = null!;

    [Column("program_area")]
    [Required(ErrorMessage = "Program area is required.")]
    public string? ProgramArea { get; set; }

    [Column("amount_allocated")]
    [Required(ErrorMessage = "Allocated amount is required.")]
    [Range(typeof(decimal), "0.01", "79228162514264337593543950335", ErrorMessage = "Allocated amount must be greater than zero.")]
    public decimal? AmountAllocated { get; set; }

    [Column("allocation_date")]
    [Required(ErrorMessage = "Allocation date is required.")]
    public DateTime? AllocationDate { get; set; }

    [Column("allocation_notes")]
    public string? AllocationNotes { get; set; }
}
