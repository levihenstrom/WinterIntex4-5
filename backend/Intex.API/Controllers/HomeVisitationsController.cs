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
[Authorize(Policy = AuthPolicies.ManageCatalog)]
public class HomeVisitationsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<HomeVisitation>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<HomeVisitation>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] int? residentId = null,
        CancellationToken cancellationToken = default)
    {
        var query = db.HomeVisitations.AsNoTracking().AsQueryable();
        if (residentId is { } rid)
            query = query.Where(h => h.ResidentId == rid);

        query = query.OrderByDescending(h => h.VisitDate).ThenBy(h => h.VisitationId);
        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
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
