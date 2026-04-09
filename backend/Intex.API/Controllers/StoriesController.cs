using Intex.API.Authorization;
using Intex.API.Data;
using Intex.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

public record CreateStoryDto(string Content, string? AuthorName);

[ApiController]
[Route("api/stories")]
public class StoriesController(AppDbContext db) : ControllerBase
{
    /// <summary>Public — list all stories newest first.</summary>
    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var stories = await db.Stories
            .AsNoTracking()
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(stories);
    }

    /// <summary>Authenticated — post a new story.</summary>
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateStoryDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest(new { message = "Content cannot be empty." });

        if (dto.Content.Length > 500)
            return BadRequest(new { message = "Story cannot exceed 500 characters." });

        var email = User.Identity?.Name ?? User.FindFirst("email")?.Value ?? "anonymous";
        var role  = User.IsInRole("Admin")  ? "Admin"
                  : User.IsInRole("Staff")  ? "Staff"
                  : User.IsInRole("Donor")  ? "Donor"
                  : "Volunteer";

        var story = new Story
        {
            AuthorEmail = email,
            AuthorName  = dto.AuthorName?.Trim() ?? email.Split('@')[0],
            AuthorRole  = role,
            Content     = dto.Content.Trim(),
            CreatedAt   = DateTime.UtcNow,
            LikesCount  = 0,
        };

        db.Stories.Add(story);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(story);
    }

    /// <summary>Authenticated — like a story.</summary>
    [Authorize]
    [HttpPost("{id:int}/like")]
    public async Task<IActionResult> Like(int id, CancellationToken cancellationToken)
    {
        var story = await db.Stories.FindAsync([id], cancellationToken);
        if (story is null) return NotFound();
        story.LikesCount++;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { likes = story.LikesCount });
    }

    /// <summary>Admin — delete any story.</summary>
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var story = await db.Stories.FindAsync([id], cancellationToken);
        if (story is null) return NotFound();
        db.Stories.Remove(story);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
