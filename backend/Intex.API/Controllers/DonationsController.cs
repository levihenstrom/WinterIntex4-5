using System.Security.Claims;
using Intex.API.Authorization;
using Intex.API.Contracts;
using Intex.API.Data;
using Intex.API.Extensions;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/donations")]
public class DonationsController(AppDbContext db, StaffScopeResolver scopeResolver) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(PagedResult<Donation>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<Donation>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] int? supporterId = null,
        [FromQuery] string? donationType = null,
        CancellationToken cancellationToken = default)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        var query = scope.Apply(
            db.Donations.AsNoTracking()
                .Include(d => d.Supporter)
                .AsQueryable());
        if (supporterId is { } sid)
            query = query.Where(d => d.SupporterId == sid);
        if (!string.IsNullOrWhiteSpace(donationType))
            query = query.Where(d => d.DonationType == donationType);

        query = query.OrderByDescending(d => d.DonationDate).ThenBy(d => d.DonationId);
        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Donor self-service: return donations for the supporter linked to the current user
    /// via the "supporterId" claim. Admins without a claim see an empty result.
    /// </summary>
    [HttpGet("mine")]
    [Authorize(Policy = AuthPolicies.DonorSelfService)]
    [ProducesResponseType(typeof(PagedResult<Donation>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<Donation>>> GetMine(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var supporterIdClaim = User.FindFirstValue(StaffScopeResolver.SupporterIdClaimType);
        if (!int.TryParse(supporterIdClaim, out var supporterId))
        {
            return Ok(new PagedResult<Donation>
            {
                Page = 1,
                PageSize = pageSize,
                TotalCount = 0,
                Items = Array.Empty<Donation>()
            });
        }

        var query = db.Donations.AsNoTracking()
            .Include(d => d.Supporter)
            .Include(d => d.DonationAllocations)
            .Where(d => d.SupporterId == supporterId)
            .OrderByDescending(d => d.DonationDate)
            .ThenBy(d => d.DonationId);

        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Records a non-payment-processor "demo" gift for the logged-in donor's linked supporter (IS 413).
    /// </summary>
    [HttpPost("demo-gift")]
    [Authorize(Policy = AuthPolicies.DonorSelfService)]
    [ProducesResponseType(typeof(Donation), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<Donation>> RecordDemoGift(
        [FromBody] RecordDemoGiftRequest body,
        CancellationToken cancellationToken)
    {
        var supporterIdClaim = User.FindFirstValue(StaffScopeResolver.SupporterIdClaimType);
        if (!int.TryParse(supporterIdClaim, out var supporterId))
            return BadRequest(new { message = "Your account is not linked to a supporter profile. Staff can record gifts in the admin portal." });

        if (body.Amount <= 0)
            return BadRequest(new { message = "Amount must be greater than zero." });

        var donation = new Donation
        {
            SupporterId = supporterId,
            DonationType = string.IsNullOrWhiteSpace(body.DonationType) ? "Monetary" : body.DonationType.Trim(),
            DonationDate = DateTime.UtcNow.Date,
            IsRecurring = false,
            CampaignName = string.IsNullOrWhiteSpace(body.CampaignName) ? "Demo / classroom gift" : body.CampaignName.Trim(),
            ChannelSource = "DemoPortal",
            CurrencyCode = string.IsNullOrWhiteSpace(body.CurrencyCode) ? "PHP" : body.CurrencyCode.Trim(),
            Amount = body.Amount,
            EstimatedValue = body.Amount,
            ImpactUnit = body.ImpactUnit,
            Notes = string.IsNullOrWhiteSpace(body.Notes)
                ? "Recorded via donor portal (demo — not a live payment)."
                : body.Notes.Trim(),
        };

        db.Donations.Add(donation);
        await db.SaveChangesAsync(cancellationToken);

        await db.Entry(donation).Reference(d => d.Supporter).LoadAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, donation);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(Donation), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Donation>> GetById(int id, CancellationToken cancellationToken)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        var entity = await scope.Apply(db.Donations.AsNoTracking().AsQueryable())
            .FirstOrDefaultAsync(d => d.DonationId == id, cancellationToken);
        if (entity is null)
            return NotFound();
        return Ok(entity);
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(typeof(Donation), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<Donation>> Create([FromBody] Donation donation, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        donation.DonationId = 0;
        db.Donations.Add(donation);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = donation.DonationId }, donation);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] Donation donation, CancellationToken cancellationToken)
    {
        if (id != donation.DonationId)
            return BadRequest();
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        db.Donations.Update(donation);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var entity = await db.Donations.FindAsync([id], cancellationToken);
        if (entity is null)
            return NotFound();
        db.Donations.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

public sealed class RecordDemoGiftRequest
{
    public decimal Amount { get; set; }
    public string? DonationType { get; set; }
    public string? CampaignName { get; set; }
    public string? CurrencyCode { get; set; }
    public string? ImpactUnit { get; set; }
    public string? Notes { get; set; }
}
