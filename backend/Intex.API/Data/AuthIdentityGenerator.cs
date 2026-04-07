using Microsoft.AspNetCore.Identity;

namespace Intex.API.Data;

public class AuthIdentityGenerator
{
    public static async Task GenerateDefaultIdentityAsync(
        IServiceProvider serviceProvider, IConfiguration configuration)
    {
        var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        foreach (var roleName in new[] { AuthRoles.Admin, AuthRoles.Staff, AuthRoles.Donor, AuthRoles.LegacyCustomer })
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                var result = await roleManager.CreateAsync(new IdentityRole(roleName));
                if (!result.Succeeded)
                    throw new Exception($"Failed to create role '{roleName}': "
                        + string.Join(", ", result.Errors.Select(e => e.Description)));
            }
        }

        await EnsureSeedUserAsync(userManager, configuration,
            "GenerateDefaultIdentityAdmin", "admin@intex.local", "Intex2026!Admin", AuthRoles.Admin);

        await EnsureSeedUserAsync(userManager, configuration,
            "GenerateDefaultIdentityStaff", "staff@intex.local", "Intex2026!Staff", AuthRoles.Staff);

        await EnsureSeedUserAsync(userManager, configuration,
            "GenerateDefaultIdentityDonor", "donor@intex.local", "Intex2026!Donor", AuthRoles.Donor);
    }

    private static async Task EnsureSeedUserAsync(
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        string configSection,
        string defaultEmail,
        string defaultPassword,
        string role)
    {
        var section = configuration.GetSection(configSection);
        var email = section["Email"] ?? defaultEmail;
        var password = section["Password"] ?? defaultPassword;

        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true
            };

            var createResult = await userManager.CreateAsync(user, password);
            if (!createResult.Succeeded)
                throw new Exception($"Failed to create seed user '{email}': "
                    + string.Join(", ", createResult.Errors.Select(e => e.Description)));
        }

        if (!await userManager.IsInRoleAsync(user, role))
        {
            var roleResult = await userManager.AddToRoleAsync(user, role);
            if (!roleResult.Succeeded)
                throw new Exception($"Failed to assign role '{role}' to '{email}': "
                    + string.Join(", ", roleResult.Errors.Select(e => e.Description)));
        }
    }
}
