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

        // Staff seed user is linked to Partner #1 (Ana Reyes — SafehouseOps, safehouses 8 & 9)
        // via a "partnerId" claim. StaffScopeResolver uses this to scope visibility.
        var staffUser = await EnsureSeedUserAsync(userManager, configuration,
            "GenerateDefaultIdentityStaff", "staff@intex.local", "Intex2026!Staff", AuthRoles.Staff);
        await EnsurePartnerClaimAsync(userManager, staffUser, partnerId: 1);

        // Donor seed user is linked to Supporter #1 via a "supporterId" claim.
        // Used by /api/donations/mine and other donor self-service endpoints.
        var donorUser = await EnsureSeedUserAsync(userManager, configuration,
            "GenerateDefaultIdentityDonor", "donor@intex.local", "Intex2026!Donor", AuthRoles.Donor);
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

        return user;
    }
}
