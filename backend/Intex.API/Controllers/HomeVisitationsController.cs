using Intex.API.Contracts;
using Intex.API.Data;
using Intex.API.Extensions;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/home-visitations")]
public class HomeVisitationsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(PagedResult<HomeVisitation>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<HomeVisitation>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] int? residentId = null,
        [FromQuery] string? visitType = null,
        [FromQuery] bool? followUpNeeded = null,
        [FromQuery] bool? safetyConcernsNoted = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var query = db.HomeVisitations.AsNoTracking().AsQueryable();
        if (residentId is { } rid)
            query = query.Where(h => h.ResidentId == rid);
        if (!string.IsNullOrWhiteSpace(visitType))
            query = query.Where(v => v.VisitType == visitType);
        if (followUpNeeded is { } f)
            query = query.Where(v => v.FollowUpNeeded == f);
        if (safetyConcernsNoted is { } s)
            query = query.Where(v => v.SafetyConcernsNoted == s);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim();
            if (int.TryParse(q, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var ridFromSearch))
                query = query.Where(v => v.ResidentId == ridFromSearch);
            else
            {
                var needle = q.ToLower();
                query = query.Where(v =>
                    (v.SocialWorker != null && v.SocialWorker.ToLower().Contains(needle)) ||
                    (v.VisitType != null && v.VisitType.ToLower().Contains(needle)) ||
                    (v.LocationVisited != null && v.LocationVisited.ToLower().Contains(needle)) ||
                    (v.Observations != null && v.Observations.ToLower().Contains(needle)));
            }
        }

        query = query.OrderByDescending(h => h.VisitDate).ThenBy(h => h.VisitationId);
        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(HomeVisitation), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HomeVisitation>> GetById(int id, CancellationToken cancellationToken)
    {
        var entity = await db.HomeVisitations.AsNoTracking().FirstOrDefaultAsync(h => h.VisitationId == id, cancellationToken);
        if (entity is null)
            return NotFound();
        return Ok(entity);
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(typeof(HomeVisitation), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<HomeVisitation>> Create([FromBody] HomeVisitation visitation, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        visitation.VisitationId = 0;
        db.HomeVisitations.Add(visitation);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = visitation.VisitationId }, visitation);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] HomeVisitation visitation, CancellationToken cancellationToken)
    {
        if (id != visitation.VisitationId)
            return BadRequest();
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        db.HomeVisitations.Update(visitation);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var entity = await db.HomeVisitations.FindAsync([id], cancellationToken);
        if (entity is null)
            return NotFound();
        db.HomeVisitations.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
