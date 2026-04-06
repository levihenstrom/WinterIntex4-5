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
[Authorize(Policy = AuthPolicies.ManageCatalog)]
public class DonationsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<Donation>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<Donation>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] int? supporterId = null,
        [FromQuery] string? donationType = null,
        CancellationToken cancellationToken = default)
    {
        var query = db.Donations.AsNoTracking().AsQueryable();
        if (supporterId is { } sid)
            query = query.Where(d => d.SupporterId == sid);
        if (!string.IsNullOrWhiteSpace(donationType))
            query = query.Where(d => d.DonationType == donationType);

        query = query.OrderByDescending(d => d.DonationDate).ThenBy(d => d.DonationId);
        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(Donation), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Donation>> GetById(int id, CancellationToken cancellationToken)
    {
        var entity = await db.Donations.AsNoTracking().FirstOrDefaultAsync(d => d.DonationId == id, cancellationToken);
        if (entity is null)
            return NotFound();
        return Ok(entity);
    }

    [HttpPost]
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
