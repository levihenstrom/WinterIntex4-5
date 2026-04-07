using Intex.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Controllers;

/// <summary>
/// SOC-1 sub-page endpoint. Returns a next-post recommendation derived from
/// historical engagement in <c>social_media_posts</c>. This is a simple
/// explainable heuristic — ML-3 will replace the scoring later without changing
/// the response shape.
/// </summary>
[ApiController]
[Route("api/social-media-suggestions")]
public class SocialMediaSuggestionsController(AppDbContext db) : ControllerBase
{
    [HttpGet("next-post")]
    [Authorize(Policy = AuthPolicies.StaffRead)]
    [ProducesResponseType(typeof(NextPostSuggestion), StatusCodes.Status200OK)]
    public async Task<ActionResult<NextPostSuggestion>> GetNextPostSuggestion(
        CancellationToken cancellationToken)
    {
        // Pull a slimmed client-side projection of posts and compute in memory.
        // Dataset is small enough that grouping in memory keeps the query simple
        // and avoids EF translation issues with nullable aggregates.
        var posts = await db.SocialMediaPosts.AsNoTracking()
            .Where(p => p.Platform != null)
            .Select(p => new
            {
                p.Platform,
                p.PostType,
                p.DayOfWeek,
                p.PostHour,
                p.EngagementRate,
                p.DonationReferrals
            })
            .ToListAsync(cancellationToken);

        if (posts.Count == 0)
        {
            return Ok(new NextPostSuggestion
            {
                Platform = null,
                PostType = null,
                DayOfWeek = null,
                PostHour = null,
                Explanation = "No historical posts available to base a recommendation on.",
                SampleSize = 0
            });
        }

        static double Score(decimal? rate, int? referrals)
            => (double)(rate ?? 0m) + ((referrals ?? 0) * 0.5);

        var bestPlatform = posts
            .GroupBy(p => p.Platform)
            .Select(g => new
            {
                Platform = g.Key,
                Count = g.Count(),
                AvgScore = g.Average(p => Score(p.EngagementRate, p.DonationReferrals))
            })
            .OrderByDescending(x => x.AvgScore)
            .First();

        var platformPosts = posts.Where(p => p.Platform == bestPlatform.Platform).ToList();

        var bestPostType = platformPosts
            .Where(p => p.PostType != null)
            .GroupBy(p => p.PostType)
            .Select(g => new
            {
                PostType = g.Key,
                AvgScore = g.Average(p => Score(p.EngagementRate, p.DonationReferrals))
            })
            .OrderByDescending(x => x.AvgScore)
            .FirstOrDefault();

        var bestDay = platformPosts
            .Where(p => p.DayOfWeek != null)
            .GroupBy(p => p.DayOfWeek)
            .Select(g => new
            {
                DayOfWeek = g.Key,
                AvgScore = g.Average(p => Score(p.EngagementRate, p.DonationReferrals))
            })
            .OrderByDescending(x => x.AvgScore)
            .FirstOrDefault();

        var bestHour = platformPosts
            .Where(p => p.PostHour != null)
            .GroupBy(p => p.PostHour)
            .Select(g => new
            {
                Hour = g.Key,
                AvgScore = g.Average(p => Score(p.EngagementRate, p.DonationReferrals))
            })
            .OrderByDescending(x => x.AvgScore)
            .FirstOrDefault();

        var suggestion = new NextPostSuggestion
        {
            Platform = bestPlatform.Platform,
            PostType = bestPostType?.PostType,
            DayOfWeek = bestDay?.DayOfWeek,
            PostHour = bestHour?.Hour,
            SampleSize = posts.Count,
            Explanation = BuildExplanation(
                bestPlatform.Platform, bestPlatform.AvgScore, bestPlatform.Count,
                bestPostType?.PostType, bestDay?.DayOfWeek, bestHour?.Hour)
        };

        return Ok(suggestion);
    }

    private static string BuildExplanation(
        string? platform, double avgScore, int sampleSize,
        string? postType, string? dayOfWeek, int? hour)
    {
        var parts = new List<string>();
        if (platform != null)
            parts.Add($"{platform} has the highest average engagement score ({avgScore:F2}) across {sampleSize} historical posts.");
        if (postType != null)
            parts.Add($"{postType} posts perform best on that platform.");
        if (dayOfWeek != null)
            parts.Add($"{dayOfWeek} is the strongest day.");
        if (hour != null)
            parts.Add($"{hour:D2}:00 is the strongest posting hour.");
        parts.Add("Heuristic: engagement_rate + 0.5 × donation_referrals. ML-3 will replace this with a learned model.");
        return string.Join(" ", parts);
    }
}

public sealed class NextPostSuggestion
{
    public string? Platform { get; set; }
    public string? PostType { get; set; }
    public string? DayOfWeek { get; set; }
    public int? PostHour { get; set; }
    public int SampleSize { get; set; }
    public string Explanation { get; set; } = string.Empty;
}
