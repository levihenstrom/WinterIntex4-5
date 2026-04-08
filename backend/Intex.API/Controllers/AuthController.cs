using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using Intex.API.Authorization;
using Intex.API.Data;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    IConfiguration configuration,
    AppDbContext appDb,
    Services.RefreshTokenStore refreshTokenStore) : ControllerBase
{
    private const string DefaultFrontendUrl = "http://localhost:3000";
    private const string DefaultExternalReturnPath = "/";

    [AllowAnonymous]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentSession()
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Ok(new
            {
                isAuthenticated = false,
                userName = (string?)null,
                email = (string?)null,
                roles = Array.Empty<string>()
            });
        }

        var user = await userManager.GetUserAsync(User);
        var roles = User.Claims
            .Where(c => c.Type == ClaimTypes.Role)
            .Select(c => c.Value)
            .Distinct()
            .OrderBy(r => r)
            .ToArray();

        return Ok(new
        {
            isAuthenticated = true,
            userName = user?.UserName ?? User.Identity?.Name,
            email = user?.Email,
            roles
        });
    }

    [AllowAnonymous]
    [HttpGet("providers")]
    public IActionResult GetExternalProviders()
    {
        var providers = new List<object>();

        if (IsGoogleConfigured())
        {
            providers.Add(new
            {
                name = GoogleDefaults.AuthenticationScheme,
                displayName = "Google"
            });
        }

        return Ok(providers);
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email and password are required." });

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            foreach (var error in createResult.Errors)
                ModelState.AddModelError(error.Code, error.Description);
            return ValidationProblem(ModelState);
        }

        var roleResult = await userManager.AddToRoleAsync(user, AuthRoles.Donor);
        if (!roleResult.Succeeded)
        {
            await userManager.DeleteAsync(user);
            foreach (var error in roleResult.Errors)
                ModelState.AddModelError(error.Code, error.Description);
            return ValidationProblem(ModelState);
        }

        return Ok(new { message = "Registration successful.", assignedRole = AuthRoles.Donor });
    }
// user for the user manager
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers()
    {
        var users = await userManager.Users
            .OrderBy(u => u.Email)
            .ToListAsync();

        var result = new List<object>();
        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);
            result.Add(new
            {
                email = user.Email,
                roles = roles.OrderBy(r => r).ToArray()
            });
        }

        return Ok(result);
    }

    [Authorize(Policy = AuthPolicies.AdminOnly)]
    [HttpPost("assign-role")]
    public async Task<IActionResult> AssignRole([FromBody] AssignRoleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Role))
            return BadRequest(new { message = "Email and role are required." });

        var normalizedRole = request.Role.Trim();
        var allowedRoles = new[] { AuthRoles.Admin, AuthRoles.Staff, AuthRoles.Donor };
        if (!allowedRoles.Contains(normalizedRole, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { message = "Role must be Admin, Staff, or Donor." });

        var canonicalRole = allowedRoles.First(r => string.Equals(r, normalizedRole, StringComparison.OrdinalIgnoreCase));
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
            return NotFound(new { message = "User not found." });

        foreach (var role in allowedRoles.Concat([AuthRoles.LegacyCustomer]))
        {
            if (await userManager.IsInRoleAsync(user, role))
            {
                var removalResult = await userManager.RemoveFromRoleAsync(user, role);
                if (!removalResult.Succeeded)
                {
                    foreach (var error in removalResult.Errors)
                        ModelState.AddModelError(error.Code, error.Description);
                    return ValidationProblem(ModelState);
                }
            }
        }

        var addRoleResult = await userManager.AddToRoleAsync(user, canonicalRole);
        if (!addRoleResult.Succeeded)
        {
            foreach (var error in addRoleResult.Errors)
                ModelState.AddModelError(error.Code, error.Description);
            return ValidationProblem(ModelState);
        }

        return Ok(new { message = "Role assigned successfully.", email = user.Email, role = canonicalRole });
    }
    //// SECURE END POINT TO CREATE A USER

    [Authorize(Policy = AuthPolicies.AdminOnly)]
    [HttpPost("create-user")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.Role))
            return BadRequest(new { message = "Email, password, and role are required." });

        var normalizedRole = request.Role.Trim();
        var allowedRoles = new[] { AuthRoles.Admin, AuthRoles.Staff, AuthRoles.Donor };
        if (!allowedRoles.Contains(normalizedRole, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { message = "Role must be Admin, Staff, or Donor." });

        var canonicalRole = allowedRoles.First(r => string.Equals(r, normalizedRole, StringComparison.OrdinalIgnoreCase));

        var user = new ApplicationUser
        {
            UserName = request.Email.Trim(),
            Email = request.Email.Trim(),
            EmailConfirmed = true
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            foreach (var error in createResult.Errors)
                ModelState.AddModelError(error.Code, error.Description);
            return ValidationProblem(ModelState);
        }

        var roleResult = await userManager.AddToRoleAsync(user, canonicalRole);
        if (!roleResult.Succeeded)
        {
            await userManager.DeleteAsync(user);
            foreach (var error in roleResult.Errors)
                ModelState.AddModelError(error.Code, error.Description);
            return ValidationProblem(ModelState);
        }

        return Ok(new { message = "User created successfully.", email = user.Email, role = canonicalRole });
    }

    [Authorize(Policy = AuthPolicies.AdminOnly)]
    [HttpPost("assign-staff-partner")]
    public async Task<IActionResult> AssignStaffPartner([FromBody] AssignStaffPartnerRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "Email is required." });

        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
            return NotFound(new { message = "User not found." });

        var partner = await appDb.Partners.AsNoTracking()
            .FirstOrDefaultAsync(p => p.PartnerId == request.PartnerId);
        if (partner is null)
            return NotFound(new { message = "Partner not found." });

        if (!await userManager.IsInRoleAsync(user, AuthRoles.Staff)
            && !await userManager.IsInRoleAsync(user, AuthRoles.Admin))
        {
            return BadRequest(new { message = "User must have Staff or Admin role before assigning a partner." });
        }

        var existingClaims = await userManager.GetClaimsAsync(user);
        foreach (var claim in existingClaims.Where(c => c.Type == StaffScopeResolver.PartnerIdClaimType).ToList())
        {
            var removeResult = await userManager.RemoveClaimAsync(user, claim);
            if (!removeResult.Succeeded)
            {
                foreach (var error in removeResult.Errors)
                    ModelState.AddModelError(error.Code, error.Description);
                return ValidationProblem(ModelState);
            }
        }

        var addResult = await userManager.AddClaimAsync(
            user,
            new Claim(StaffScopeResolver.PartnerIdClaimType, request.PartnerId.ToString()));
        if (!addResult.Succeeded)
        {
            foreach (var error in addResult.Errors)
                ModelState.AddModelError(error.Code, error.Description);
            return ValidationProblem(ModelState);
        }

        return Ok(new
        {
            message = "Staff partner assignment updated successfully. User must sign out and sign back in to refresh claims.",
            email = user.Email,
            partnerId = partner.PartnerId,
            partnerName = partner.PartnerName
        });
    }

    [AllowAnonymous]
    [HttpPost("password-login")]
    public async Task<IActionResult> PasswordLogin([FromBody] PasswordLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email and password are required." });

        var result = await signInManager.PasswordSignInAsync(
            request.Email,
            request.Password,
            request.RememberMe,
            lockoutOnFailure: true);

        if (result.RequiresTwoFactor)
            return Ok(new { requiresTwoFactor = true });

        if (result.Succeeded)
        {
            var user = await userManager.FindByEmailAsync(request.Email)
                ?? await userManager.FindByNameAsync(request.Email);

            if (user is null)
                return Unauthorized(new { message = "User account not found." });

            return Ok(await BuildSessionResponseAsync(user, requiresTwoFactor: false));
        }

        if (result.IsLockedOut)
            return Unauthorized(new { message = "This account is locked. Try again later." });

        if (result.IsNotAllowed)
            return Unauthorized(new { message = "This account is not allowed to sign in." });

        return Unauthorized(new { message = "Invalid email or password." });
    }

    [AllowAnonymous]
    [HttpPost("password-login/2fa")]
    public async Task<IActionResult> CompleteTwoFactorLogin([FromBody] TwoFactorLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TwoFactorCode)
            && string.IsNullOrWhiteSpace(request.RecoveryCode))
        {
            return BadRequest(new { message = "Enter an authenticator code or a recovery code." });
        }

        var twoFactorUser = await signInManager.GetTwoFactorAuthenticationUserAsync();
        if (twoFactorUser is null)
            return Unauthorized(new { message = "The two-factor sign-in session expired. Start sign-in again." });

        Microsoft.AspNetCore.Identity.SignInResult result;
        if (!string.IsNullOrWhiteSpace(request.RecoveryCode))
        {
            result = await signInManager.TwoFactorRecoveryCodeSignInAsync(request.RecoveryCode);
        }
        else
        {
            var sanitizedCode = request.TwoFactorCode!.Replace(" ", string.Empty).Replace("-", string.Empty);
            result = await signInManager.TwoFactorAuthenticatorSignInAsync(
                sanitizedCode,
                request.RememberMe,
                rememberClient: false);
        }

        if (result.Succeeded)
            return Ok(await BuildSessionResponseAsync(twoFactorUser, requiresTwoFactor: false));

        if (result.IsLockedOut)
            return Unauthorized(new { message = "This account is locked. Try again later." });

        return Unauthorized(new { message = "Invalid authenticator or recovery code." });
    }

    [AllowAnonymous]
    [HttpGet("external-login")]
    public IActionResult ExternalLogin(
        [FromQuery] string provider,
        [FromQuery] string? returnPath = null)
    {
        if (!string.Equals(provider, GoogleDefaults.AuthenticationScheme,
                StringComparison.OrdinalIgnoreCase) || !IsGoogleConfigured())
        {
            return BadRequest(new { message = "The requested external login provider is not available." });
        }

        var callbackUrl = Url.Action(nameof(ExternalLoginCallback), new
        {
            returnPath = SanitizeFrontendReturnPath(returnPath)
        });

        if (string.IsNullOrWhiteSpace(callbackUrl))
            return Problem("Unable to create the external login callback URL.");

        var properties = signInManager.ConfigureExternalAuthenticationProperties(
            GoogleDefaults.AuthenticationScheme, callbackUrl);

        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    [AllowAnonymous]
    [HttpGet("external-callback")]
    public async Task<IActionResult> ExternalLoginCallback(
        [FromQuery] string? returnPath = null,
        [FromQuery] string? remoteError = null)
    {
        if (!string.IsNullOrWhiteSpace(remoteError))
            return Redirect(BuildFrontendErrorUrl("External login failed."));

        var info = await signInManager.GetExternalLoginInfoAsync();
        if (info is null)
            return Redirect(BuildFrontendErrorUrl("External login information was unavailable."));

        // Try to find an existing user for this external login
        var signInResult = await signInManager.ExternalLoginSignInAsync(
            info.LoginProvider, info.ProviderKey,
            isPersistent: true, bypassTwoFactor: true);

        ApplicationUser? resolvedUser = null;

        if (signInResult.Succeeded)
        {
            // ExternalLoginSignInAsync set a cookie on this domain, but we need
            // the userId for the token flow. Look up by email from the provider.
            var email2 = info.Principal.FindFirstValue(ClaimTypes.Email)
                         ?? info.Principal.FindFirstValue("email");
            if (!string.IsNullOrWhiteSpace(email2))
                resolvedUser = await userManager.FindByEmailAsync(email2);
        }
        else
        {
            var email = info.Principal.FindFirstValue(ClaimTypes.Email)
                        ?? info.Principal.FindFirstValue("email");

            if (string.IsNullOrWhiteSpace(email))
                return Redirect(BuildFrontendErrorUrl("The external provider did not return an email address."));

            resolvedUser = await userManager.FindByEmailAsync(email);
            if (resolvedUser is null)
            {
                resolvedUser = new ApplicationUser
                {
                    UserName = email,
                    Email = email,
                    EmailConfirmed = true
                };

                var createResult = await userManager.CreateAsync(resolvedUser);
                if (!createResult.Succeeded)
                    return Redirect(BuildFrontendErrorUrl("Unable to create a local account for the external login."));

                var donorRoleResult = await userManager.AddToRoleAsync(resolvedUser, AuthRoles.Donor);
                if (!donorRoleResult.Succeeded)
                    return Redirect(BuildFrontendErrorUrl("Unable to assign the default donor role."));
            }

            var addLoginResult = await userManager.AddLoginAsync(resolvedUser, info);
            if (!addLoginResult.Succeeded)
                return Redirect(BuildFrontendErrorUrl("Unable to associate the external login with the local account."));
        }

        if (resolvedUser is null)
            return Redirect(BuildFrontendErrorUrl("Unable to resolve the user account."));

        // Sign out any external scheme cookie (cleanup)
        await signInManager.SignOutAsync();

        // Mint a single-use token and redirect to the frontend with it.
        // The frontend will immediately redirect to /api/auth/exchange-token (top-level navigation)
        // which sets the Identity cookie as a first-party cookie (fixes mobile Safari/Chrome).
        var token = refreshTokenStore.Create(resolvedUser.Id, TimeSpan.FromMinutes(2));

        // Always land on a public SPA route first so RequireAuth never runs before the token is exchanged.
        var frontendUrl = configuration["FrontendUrl"] ?? DefaultFrontendUrl;
        var safeReturnPath = SanitizeFrontendReturnPath(returnPath);
        var oauthCallback = $"{frontendUrl.TrimEnd('/')}/oauth/callback";
        var redirectUrl = QueryHelpers.AddQueryString(
            oauthCallback,
            new Dictionary<string, string?>
            {
                ["authToken"] = token,
                ["returnPath"] = safeReturnPath
            });

        return Redirect(redirectUrl);
    }

    /// <summary>
    /// Frontend calls this (fetch, not redirect) with the single-use token.
    /// Returns the session JSON so the frontend can store it in localStorage.
    /// Also sets the Identity cookie (works on desktop; ignored on mobile Safari).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("exchange-token")]
    public async Task<IActionResult> ExchangeToken([FromBody] ExchangeTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return BadRequest(new { message = "Token is required." });

        if (!refreshTokenStore.TryConsume(request.Token, out var userId) || string.IsNullOrWhiteSpace(userId))
            return Unauthorized(new { message = "Invalid or expired login token." });

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
            return Unauthorized(new { message = "User account not found." });

        // Set cookie (works where third-party cookies are allowed)
        await signInManager.SignInAsync(user, isPersistent: true);

        var roles = (await userManager.GetRolesAsync(user))
            .OrderBy(r => r).ToArray();

        // Return session data so frontend can store it regardless of cookie support.
        // Also return a refreshToken the frontend can use to re-validate later.
        var refreshToken = refreshTokenStore.Create(user.Id, TimeSpan.FromDays(7));

        return Ok(new
        {
            isAuthenticated = true,
            userName = user.UserName,
            email = user.Email,
            roles,
            refreshToken
        });
    }

    /// <summary>
    /// Frontend calls this with a stored refreshToken to re-validate the session
    /// (e.g., on page reload when cookies aren't available).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("refresh-session")]
    public async Task<IActionResult> RefreshSession([FromBody] RefreshSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return Unauthorized(new { message = "Refresh token is required." });

        if (!refreshTokenStore.TryGetValidUserId(request.RefreshToken, out var userId) || string.IsNullOrWhiteSpace(userId))
            return Unauthorized(new { message = "Invalid or expired refresh token." });

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
            return Unauthorized(new { message = "User account not found." });

        var roles = (await userManager.GetRolesAsync(user))
            .OrderBy(r => r).ToArray();

        return Ok(new
        {
            isAuthenticated = true,
            userName = user.UserName,
            email = user.Email,
            roles
        });
    }

    public record ExchangeTokenRequest([Required(ErrorMessage = "Token is required.")] string Token);
    public record RefreshSessionRequest([Required(ErrorMessage = "Refresh token is required.")] string RefreshToken);
    public record RegisterRequest(
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Enter a valid email address.")]
        string Email,
        [Required(ErrorMessage = "Password is required.")]
        [MinLength(14, ErrorMessage = "Password must be at least 14 characters.")]
        string Password);
    public record AssignRoleRequest(
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Enter a valid email address.")]
        string Email,
        [Required(ErrorMessage = "Role is required.")]
        string Role);
    public record AssignStaffPartnerRequest(
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Enter a valid email address.")]
        string Email,
        [Range(1, int.MaxValue, ErrorMessage = "Partner is required.")]
        int PartnerId);

    public record CreateUserRequest(
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Enter a valid email address.")]
        string Email,
        [Required(ErrorMessage = "Password is required.")]
        [MinLength(14, ErrorMessage = "Password must be at least 14 characters.")]
        string Password,
        [Required(ErrorMessage = "Role is required.")]
        string Role);
    public record PasswordLoginRequest(
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Enter a valid email address.")]
        string Email,
        [Required(ErrorMessage = "Password is required.")]
        string Password,
        bool RememberMe);
    public record TwoFactorLoginRequest(
        string? TwoFactorCode,
        string? RecoveryCode,
        bool RememberMe);

    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest? request = null)
    {
        await signInManager.SignOutAsync();

        // Remove stored refresh token if provided
        if (!string.IsNullOrWhiteSpace(request?.RefreshToken))
            refreshTokenStore.Remove(request.RefreshToken);

        return Ok(new { message = "Logout successful." });
    }

    public record LogoutRequest(string? RefreshToken);

    private bool IsGoogleConfigured() =>
        !string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientId"]) &&
        !string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientSecret"]);

    private string NormalizeReturnPath(string? returnPath) =>
        string.IsNullOrWhiteSpace(returnPath) || !returnPath.StartsWith('/')
            ? DefaultExternalReturnPath
            : returnPath;

    /// <summary>
    /// Prevents open redirects: only same-site relative paths (single leading slash, no scheme).
    /// </summary>
    private string SanitizeFrontendReturnPath(string? returnPath)
    {
        var path = NormalizeReturnPath(returnPath);
        if (path.StartsWith("//", StringComparison.Ordinal) || path.Contains("://", StringComparison.Ordinal))
            return DefaultExternalReturnPath;
        if (path.Length > 512)
            return DefaultExternalReturnPath;
        return path;
    }

    private string BuildFrontendSuccessUrl(string? returnPath)
    {
        var frontendUrl = configuration["FrontendUrl"] ?? DefaultFrontendUrl;
        return $"{frontendUrl.TrimEnd('/')}{NormalizeReturnPath(returnPath)}";
    }

    private string BuildFrontendErrorUrl(string errorMessage)
    {
        var frontendUrl = configuration["FrontendUrl"] ?? DefaultFrontendUrl;
        var loginUrl = $"{frontendUrl.TrimEnd('/')}/login";
        return QueryHelpers.AddQueryString(loginUrl, "externalError", errorMessage);
    }

    private async Task<object> BuildSessionResponseAsync(ApplicationUser user, bool requiresTwoFactor)
    {
        var roles = (await userManager.GetRolesAsync(user))
            .OrderBy(r => r)
            .ToArray();

        string? refreshToken = null;
        if (!requiresTwoFactor)
        {
            refreshToken = refreshTokenStore.Create(user.Id, TimeSpan.FromDays(7));
        }

        return new
        {
            requiresTwoFactor,
            isAuthenticated = !requiresTwoFactor,
            userName = user.UserName,
            email = user.Email,
            roles,
            refreshToken
        };
    }
}
