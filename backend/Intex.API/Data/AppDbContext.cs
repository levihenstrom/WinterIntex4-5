using Microsoft.EntityFrameworkCore;

namespace Intex.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    // Add DbSet<YourModel> properties here when you have the rubric
}