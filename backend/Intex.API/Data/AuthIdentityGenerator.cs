using System.Security.Claims;
using Intex.API.Authorization;
using Microsoft.AspNetCore.Identity;

namespace Intex.API.Data;

public class AuthIdentityGenerator
{
    public static async Task GenerateDefaultIdentityAsync(
        IServiceProvider serviceProvider, IConfiguration configuration)
    {
        var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var env = serviceProvider.GetRequiredService<IHostEnvironment>();

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
            "GenerateDefaultIdentityAdmin", "admin@intex.local", "Intex2026!Admin", AuthRoles.Admin, env.IsDevelopment());

        // Staff seed user is linked to Partner #1 (Ana Reyes — SafehouseOps, safehouses 8 & 9)
        // via a "partnerId" claim. StaffScopeResolver uses this to scope visibility.
        var staffUser = await EnsureSeedUserAsync(userManager, configuration,
            "GenerateDefaultIdentityStaff", "staff@intex.local", "Intex2026!Staff", AuthRoles.Staff, env.IsDevelopment());
        await EnsurePartnerClaimAsync(userManager, staffUser, partnerId: 1);

        // Donor seed user is linked to Supporter #1 via a "supporterId" claim.
        // Used by /api/donations/mine and other donor self-service endpoints.
        var donorUser = await EnsureSeedUserAsync(userManager, configuration,
            "GenerateDefaultIdentityDonor", "donor@intex.local", "Intex2026!Donor", AuthRoles.Donor, env.IsDevelopment());
        await EnsureClaimAsync(userManager, donorUser,
            StaffScopeResolver.SupporterIdClaimType, "1");
    }

    private static Task EnsurePartnerClaimAsync(
        UserManager<ApplicationUser> userManager,
        ApplicationUser user,
        int partnerId) =>
        EnsureClaimAsync(userManager, user, StaffScopeResolver.PartnerIdClaimType, partnerId.ToString());

    private static async Task EnsureClaimAsync(
        UserManager<ApplicationUser> userManager,
        ApplicationUser user,
        string claimType,
        string claimValue)
    {
        var existing = await userManager.GetClaimsAsync(user);
        foreach (var stale in existing.Where(c => c.Type == claimType).ToList())
        {
            await userManager.RemoveClaimAsync(user, stale);
        }
        await userManager.AddClaimAsync(user, new Claim(claimType, claimValue));
    }

    private static async Task<ApplicationUser> EnsureSeedUserAsync(
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        string configSection,
        string defaultEmail,
        string defaultPassword,
        string role,
        bool resetPasswordIfExisting)
    {
        var section = configuration.GetSection(configSection);
        var email = section["Email"] ?? defaultEmail;
        // Empty string in JSON is not null — treat whitespace as "use coded default" so Identity min-length rules still pass.
        var configPassword = section["Password"];
        var password = string.IsNullOrWhiteSpace(configPassword) ? defaultPassword : configPassword;

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
        else if (resetPasswordIfExisting)
        {
            await ResetPasswordAsync(userManager, user, email, password);
        }

        if (!await userManager.IsInRoleAsync(user, role))
        {
            var roleResult = await userManager.AddToRoleAsync(user, role);
            if (!roleResult.Succeeded)
                throw new Exception($"Failed to assign role '{role}' to '{email}': "
                    + string.Join(", ", roleResult.Errors.Select(e => e.Description)));
        }

        return user;
    }

    private static async Task ResetPasswordAsync(
        UserManager<ApplicationUser> userManager,
        ApplicationUser user,
        string email,
        string password)
    {
        if (await userManager.HasPasswordAsync(user))
        {
            var removeResult = await userManager.RemovePasswordAsync(user);
            if (!removeResult.Succeeded)
                throw new Exception($"Failed to remove existing password for '{email}': "
                    + string.Join(", ", removeResult.Errors.Select(e => e.Description)));
        }

        var addResult = await userManager.AddPasswordAsync(user, password);
        if (!addResult.Succeeded)
            throw new Exception($"Failed to set seed password for '{email}': "
                + string.Join(", ", addResult.Errors.Select(e => e.Description)));
    }
}
