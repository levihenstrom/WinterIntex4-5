using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Intex.API.Models;

[Table("stories")]
public class Story
{
    [Key]
    [Column("story_id")]
    public int StoryId { get; set; }

    [Column("author_email")]
    public string? AuthorEmail { get; set; }

    [Column("author_name")]
    public string? AuthorName { get; set; }

    [Column("author_role")]
    public string? AuthorRole { get; set; }

    [Required]
    [Column("content")]
    public string Content { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("likes_count")]
    public int LikesCount { get; set; } = 0;
}
