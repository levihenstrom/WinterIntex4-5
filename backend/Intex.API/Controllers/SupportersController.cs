using Intex.API.Authorization;
using Intex.API.Contracts;
using Intex.API.Data;
using Intex.API.Extensions;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

// DTO for volunteer applications (public endpoint, no auth)
public record VolunteerApplicationDto(
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    string? OrganizationName,
    string? RelationshipType,
    string? Region,
    string? Country,
    string? AcquisitionChannel
);

[ApiController]
[Route("api/supporters")]
public class SupportersController(AppDbContext db, StaffScopeResolver scopeResolver) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(PagedResult<Supporter>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<Supporter>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] string? supporterType = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        var query = scope.Apply(db.Supporters.AsNoTracking().AsQueryable());
        if (!string.IsNullOrWhiteSpace(supporterType))
            query = query.Where(s => s.SupporterType == supporterType);
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim();
            if (int.TryParse(q, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var sid))
            {
                query = query.Where(s => s.SupporterId == sid);
            }
            else
            {
                var needle = q.ToLower();
                query = query.Where(s =>
                    (s.DisplayName != null && s.DisplayName.ToLower().Contains(needle)) ||
                    (s.OrganizationName != null && s.OrganizationName.ToLower().Contains(needle)) ||
                    (s.Email != null && s.Email.ToLower().Contains(needle)));
            }
        }

        query = query.OrderBy(s => s.SupporterId);
        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(Supporter), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Supporter>> GetById(int id, CancellationToken cancellationToken)
    {
        var scope = await scopeResolver.GetForUserAsync(User, cancellationToken);
        var entity = await scope.Apply(db.Supporters.AsNoTracking().AsQueryable())
            .FirstOrDefaultAsync(s => s.SupporterId == id, cancellationToken);
        if (entity is null)
            return NotFound();
        return Ok(entity);
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(typeof(Supporter), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<Supporter>> Create([FromBody] Supporter supporter, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        supporter.SupporterId = 0;
        db.Supporters.Add(supporter);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = supporter.SupporterId }, supporter);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] Supporter supporter, CancellationToken cancellationToken)
    {
        if (id != supporter.SupporterId)
            return BadRequest();
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        db.Supporters.Update(supporter);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var entity = await db.Supporters.FindAsync([id], cancellationToken);
        if (entity is null)
            return NotFound();
        db.Supporters.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // ── Volunteer Application Flow ────────────────────────────────────────────

    /// <summary>Check whether an email is already in the supporters table.</summary>
    [AllowAnonymous]
    [HttpGet("check-email")]
    public async Task<IActionResult> CheckEmail([FromQuery] string email, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "Email is required." });

        var exists = await db.Supporters
            .AsNoTracking()
            .AnyAsync(s => s.Email == email.Trim().ToLower(), cancellationToken);

        return Ok(new { exists });
    }

    /// <summary>Public endpoint — submit a volunteer application (stored as PendingVolunteer).</summary>
    [AllowAnonymous]
    [HttpPost("volunteer-apply")]
    public async Task<IActionResult> VolunteerApply([FromBody] VolunteerApplicationDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.FirstName) ||
            string.IsNullOrWhiteSpace(dto.LastName)  ||
            string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest(new { message = "First name, last name and email are required." });

        var emailLower = dto.Email.Trim().ToLower();
        var exists = await db.Supporters.AnyAsync(s => s.Email == emailLower, cancellationToken);
        if (exists)
            return Conflict(new { message = "You are already registered as a supporter on our site." });

        var supporter = new Supporter
        {
            SupporterType    = "Volunteer",
            FirstName        = dto.FirstName.Trim(),
            LastName         = dto.LastName.Trim(),
            DisplayName      = $"{dto.FirstName.Trim()} {dto.LastName.Trim()}",
            OrganizationName = dto.OrganizationName?.Trim(),
            RelationshipType = dto.RelationshipType?.Trim(),
            Region           = dto.Region?.Trim(),
            Country          = dto.Country?.Trim(),
            Email            = emailLower,
            Phone            = dto.Phone?.Trim(),
            AcquisitionChannel = dto.AcquisitionChannel?.Trim(),
            Status           = "PendingVolunteer",
            CreatedAt        = DateTime.UtcNow,
            FirstDonationDate = null,
        };

        db.Supporters.Add(supporter);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "Application submitted successfully.", supporterId = supporter.SupporterId });
    }

    /// <summary>Admin — list all pending volunteer applications.</summary>
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    [HttpGet("pending-volunteers")]
    public async Task<IActionResult> GetPendingVolunteers(CancellationToken cancellationToken)
    {
        var pending = await db.Supporters
            .AsNoTracking()
            .Where(s => s.Status == "PendingVolunteer")
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(pending);
    }

    /// <summary>Admin — approve a pending volunteer (sets status to Active).</summary>
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    [HttpPost("{id:int}/approve-volunteer")]
    public async Task<IActionResult> ApproveVolunteer(int id, CancellationToken cancellationToken)
    {
        var entity = await db.Supporters.FindAsync([id], cancellationToken);
        if (entity is null) return NotFound();
        if (entity.Status != "PendingVolunteer")
            return BadRequest(new { message = "This record is not a pending volunteer application." });

        entity.Status = "Active";
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "Volunteer approved and added to supporters." });
    }

    /// <summary>Admin — reject and delete a pending volunteer application.</summary>
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    [HttpDelete("{id:int}/reject-volunteer")]
    public async Task<IActionResult> RejectVolunteer(int id, CancellationToken cancellationToken)
    {
        var entity = await db.Supporters.FindAsync([id], cancellationToken);
        if (entity is null) return NotFound();
        if (entity.Status != "PendingVolunteer")
            return BadRequest(new { message = "This record is not a pending volunteer application." });

        db.Supporters.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "Application rejected." });
    }
}
