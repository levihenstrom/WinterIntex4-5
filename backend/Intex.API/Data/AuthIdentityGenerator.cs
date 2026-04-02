using Microsoft.AspNetCore.Identity;

namespace Intex.API.Data;

public class AuthIdentityGenerator
{
    public static async Task GenerateDefaultIdentityAsync(
        IServiceProvider serviceProvider, IConfiguration configuration)
    {
        var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        foreach (var roleName in new[] { AuthRoles.Admin, AuthRoles.Customer })
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                var result = await roleManager.CreateAsync(new IdentityRole(roleName));
                if (!result.Succeeded)
                    throw new Exception($"Failed to create role '{roleName}': "
                        + string.Join(", ", result.Errors.Select(e => e.Description)));
            }
        }

        var adminSection = configuration.GetSection("GenerateDefaultIdentityAdmin");
        var adminEmail = adminSection["Email"] ?? "admin@intex.local";
        var adminPassword = adminSection["Password"] ?? "Intex2026!Admin";

        var adminUser = await userManager.FindByEmailAsync(adminEmail);
        if (adminUser == null)
        {
            adminUser = new ApplicationUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                EmailConfirmed = true
            };

            var createResult = await userManager.CreateAsync(adminUser, adminPassword);
            if (!createResult.Succeeded)
                throw new Exception("Failed to create admin user: "
                    + string.Join(", ", createResult.Errors.Select(e => e.Description)));
        }

        if (!await userManager.IsInRoleAsync(adminUser, AuthRoles.Admin))
        {
            var roleResult = await userManager.AddToRoleAsync(adminUser, AuthRoles.Admin);
            if (!roleResult.Succeeded)
                throw new Exception("Failed to assign admin role: "
                    + string.Join(", ", roleResult.Errors.Select(e => e.Description)));
        }
    }
}