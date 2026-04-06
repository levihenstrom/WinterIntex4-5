using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Intex.API.Data;

/// <summary>
/// Design-time factory for <c>dotnet ef migrations</c> (uses SQLite; path matches local dev).
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        options.UseSqlite("Data Source=Intex.sqlite");
        return new AppDbContext(options.Options);
    }
}
