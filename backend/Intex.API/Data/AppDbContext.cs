using Intex.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Safehouse> Safehouses => Set<Safehouse>();
    public DbSet<Partner> Partners => Set<Partner>();
    public DbSet<PartnerAssignment> PartnerAssignments => Set<PartnerAssignment>();
    public DbSet<Supporter> Supporters => Set<Supporter>();
    public DbSet<SocialMediaPost> SocialMediaPosts => Set<SocialMediaPost>();
    public DbSet<Donation> Donations => Set<Donation>();
    public DbSet<InKindDonationItem> InKindDonationItems => Set<InKindDonationItem>();
    public DbSet<DonationAllocation> DonationAllocations => Set<DonationAllocation>();
    public DbSet<Resident> Residents => Set<Resident>();
    public DbSet<ProcessRecording> ProcessRecordings => Set<ProcessRecording>();
    public DbSet<HomeVisitation> HomeVisitations => Set<HomeVisitation>();
    public DbSet<EducationRecord> EducationRecords => Set<EducationRecord>();
    public DbSet<HealthWellbeingRecord> HealthWellbeingRecords => Set<HealthWellbeingRecord>();
    public DbSet<InterventionPlan> InterventionPlans => Set<InterventionPlan>();
    public DbSet<IncidentReport> IncidentReports => Set<IncidentReport>();
    public DbSet<SafehouseMonthlyMetric> SafehouseMonthlyMetrics => Set<SafehouseMonthlyMetric>();
    public DbSet<PublicImpactSnapshot> PublicImpactSnapshots => Set<PublicImpactSnapshot>();
    public DbSet<Story> Stories => Set<Story>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var restrict = DeleteBehavior.Restrict;

        modelBuilder.Entity<PartnerAssignment>(e =>
        {
            e.HasOne(pa => pa.Partner)
                .WithMany(p => p.PartnerAssignments)
                .HasForeignKey(pa => pa.PartnerId)
                .OnDelete(restrict);

            e.HasOne(pa => pa.Safehouse)
                .WithMany(s => s.PartnerAssignments)
                .HasForeignKey(pa => pa.SafehouseId)
                .OnDelete(restrict);
        });

        modelBuilder.Entity<Donation>(e =>
        {
            e.HasOne(d => d.Supporter)
                .WithMany(s => s.Donations)
                .HasForeignKey(d => d.SupporterId)
                .OnDelete(restrict);

            e.HasOne(d => d.ReferralPost)
                .WithMany(p => p.ReferralDonations)
                .HasForeignKey(d => d.ReferralPostId)
                .OnDelete(restrict);
        });

        modelBuilder.Entity<InKindDonationItem>(e =>
        {
            e.HasOne(i => i.Donation)
                .WithMany(d => d.InKindDonationItems)
                .HasForeignKey(i => i.DonationId)
                .OnDelete(restrict);
        });

        modelBuilder.Entity<DonationAllocation>(e =>
        {
            e.HasOne(a => a.Donation)
                .WithMany(d => d.DonationAllocations)
                .HasForeignKey(a => a.DonationId)
                .OnDelete(restrict);

            e.HasOne(a => a.Safehouse)
                .WithMany(s => s.DonationAllocations)
                .HasForeignKey(a => a.SafehouseId)
                .OnDelete(restrict);
        });

        modelBuilder.Entity<Resident>(e =>
        {
            e.HasOne(r => r.Safehouse)
                .WithMany(s => s.Residents)
                .HasForeignKey(r => r.SafehouseId)
                .OnDelete(restrict);
        });

        modelBuilder.Entity<ProcessRecording>(e =>
        {
            e.HasOne(p => p.Resident)
                .WithMany(r => r.ProcessRecordings)
                .HasForeignKey(p => p.ResidentId)
                .OnDelete(restrict);
        });

        modelBuilder.Entity<HomeVisitation>(e =>
        {
            e.HasOne(h => h.Resident)
                .WithMany(r => r.HomeVisitations)
                .HasForeignKey(h => h.ResidentId)
                .OnDelete(restrict);
        });

        modelBuilder.Entity<EducationRecord>(e =>
        {
            e.HasOne(ed => ed.Resident)
                .WithMany(r => r.EducationRecords)
                .HasForeignKey(ed => ed.ResidentId)
                .OnDelete(restrict);
        });

        modelBuilder.Entity<HealthWellbeingRecord>(e =>
        {
            e.HasOne(h => h.Resident)
                .WithMany(r => r.HealthWellbeingRecords)
                .HasForeignKey(h => h.ResidentId)
                .OnDelete(restrict);
        });

        modelBuilder.Entity<InterventionPlan>(e =>
        {
            e.HasOne(i => i.Resident)
                .WithMany(r => r.InterventionPlans)
                .HasForeignKey(i => i.ResidentId)
                .OnDelete(restrict);
        });

        modelBuilder.Entity<IncidentReport>(e =>
        {
            e.HasOne(i => i.Resident)
                .WithMany(r => r.IncidentReports)
                .HasForeignKey(i => i.ResidentId)
                .OnDelete(restrict);

            e.HasOne(i => i.Safehouse)
                .WithMany(s => s.IncidentReports)
                .HasForeignKey(i => i.SafehouseId)
                .OnDelete(restrict);
        });

        modelBuilder.Entity<SafehouseMonthlyMetric>(e =>
        {
            e.HasOne(m => m.Safehouse)
                .WithMany(s => s.SafehouseMonthlyMetrics)
                .HasForeignKey(m => m.SafehouseId)
                .OnDelete(restrict);
        });
    }
}
