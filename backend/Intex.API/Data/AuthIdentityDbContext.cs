using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Data;

public class AuthIdentityDbContext : IdentityDbContext<ApplicationUser>
{
    public AuthIdentityDbContext(DbContextOptions<AuthIdentityDbContext> options) : base(options)
    {
    }
}