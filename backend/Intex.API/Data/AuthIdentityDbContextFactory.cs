using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Intex.API.Data;

/// <summary>
/// Design-time factory for <c>dotnet ef migrations</c> targeting AuthIdentityDbContext.
/// Uses SQL Server so migrations use proper types (nvarchar, datetime2).
/// </summary>
public class AuthIdentityDbContextFactory : IDesignTimeDbContextFactory<AuthIdentityDbContext>
{
    public AuthIdentityDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AuthIdentityDbContext>();
        options.UseSqlServer("Server=.;Database=intex_design;Trusted_Connection=True;");
        return new AuthIdentityDbContext(options.Options);
    }
}
