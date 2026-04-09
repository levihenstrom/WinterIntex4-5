using Intex.API.Contracts;
using Intex.API.Data;
using Intex.API.Extensions;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/social-media-posts")]
public class SocialMediaPostsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(PagedResult<SocialMediaPost>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<SocialMediaPost>>> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Pagination.DefaultPageSize,
        [FromQuery] string? platform = null,
        [FromQuery] string? campaignName = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var query = db.SocialMediaPosts.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(platform))
            query = query.Where(p => p.Platform == platform);
        if (!string.IsNullOrWhiteSpace(campaignName))
            query = query.Where(p => p.CampaignName == campaignName);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim();
            if (int.TryParse(q, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var postId))
                query = query.Where(p => p.PostId == postId);
            else
            {
                var needle = q.ToLower();
                query = query.Where(p =>
                    (p.Caption != null && p.Caption.ToLower().Contains(needle)) ||
                    (p.Hashtags != null && p.Hashtags.ToLower().Contains(needle)) ||
                    (p.PostType != null && p.PostType.ToLower().Contains(needle)) ||
                    (p.Platform != null && p.Platform.ToLower().Contains(needle)));
            }
        }

        query = query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.PostId);
        var result = await query.ToPagedResultAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(SocialMediaPost), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SocialMediaPost>> GetById(int id, CancellationToken cancellationToken)
    {
        var entity = await db.SocialMediaPosts.AsNoTracking().FirstOrDefaultAsync(p => p.PostId == id, cancellationToken);
        if (entity is null)
            return NotFound();
        return Ok(entity);
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(typeof(SocialMediaPost), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SocialMediaPost>> Create([FromBody] SocialMediaPost post, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        post.PostId = 0;
        db.SocialMediaPosts.Add(post);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = post.PostId }, post);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] SocialMediaPost post, CancellationToken cancellationToken)
    {
        if (id != post.PostId)
            return BadRequest();
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        db.SocialMediaPosts.Update(post);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.StaffWrite)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var entity = await db.SocialMediaPosts.FindAsync([id], cancellationToken);
        if (entity is null)
            return NotFound();
        db.SocialMediaPosts.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
