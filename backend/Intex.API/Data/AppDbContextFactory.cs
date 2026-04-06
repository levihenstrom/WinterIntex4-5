using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Intex.API.Data;

/// <summary>
/// Design-time factory for <c>dotnet ef migrations</c>.
/// Targets SQL Server so migrations use proper types (nvarchar, datetime2, int IDENTITY).
/// SQLite handles these at runtime via type-affinity — no separate migration set needed.
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        // Uses a placeholder connection — migrations are schema-only, no real connection needed at generation time.
        var options = new DbContextOptionsBuilder<AppDbContext>();
        options.UseSqlServer("Server=.;Database=intex_design;Trusted_Connection=True;");
        return new AppDbContext(options.Options);
    }
}
