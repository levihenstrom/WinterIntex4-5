using System.Collections.Concurrent;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Intex.API.Data;

namespace Intex.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    IConfiguration configuration) : ControllerBase
{
    private const string DefaultFrontendUrl = "http://localhost:3000";
    private const string DefaultExternalReturnPath = "/";

    // Single-use tokens for cross-site OAuth flow (mobile Safari/Chrome block third-party cookies).
    // After Google sign-in the backend mints a token → frontend redirects back to /api/auth/exchange-token
    // as a top-level navigation → cookie is set first-party → redirect to frontend.
    private static readonly ConcurrentDictionary<string, (string UserId, DateTime Expiry)> _pendingTokens = new();

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
            returnPath = NormalizeReturnPath(returnPath)
        });

        if (string.IsNullOrWhiteSpace(callbackUrl))
            return Problem("Unable to create the external login callback URL.");

        var properties = signInManager.ConfigureExternalAuthenticationProperties(
            GoogleDefaults.AuthenticationScheme, callbackUrl);

        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

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
        var token = GenerateToken();
        PurgeExpiredTokens();
        _pendingTokens[token] = (resolvedUser.Id, DateTime.UtcNow.AddMinutes(2));

        var frontendUrl = configuration["FrontendUrl"] ?? DefaultFrontendUrl;
        var callbackPath = NormalizeReturnPath(returnPath);
        var redirectUrl = QueryHelpers.AddQueryString(
            $"{frontendUrl.TrimEnd('/')}{callbackPath}",
            new Dictionary<string, string?> { ["authToken"] = token });

        return Redirect(redirectUrl);
    }

    [HttpGet("exchange-token")]
    public async Task<IActionResult> ExchangeToken(
        [FromQuery] string token,
        [FromQuery] string? returnPath = null)
    {
        PurgeExpiredTokens();

        if (!_pendingTokens.TryRemove(token, out var entry))
            return Redirect(BuildFrontendErrorUrl("Invalid or expired login token. Please try again."));

        if (DateTime.UtcNow > entry.Expiry)
            return Redirect(BuildFrontendErrorUrl("Login token has expired. Please try again."));

        var user = await userManager.FindByIdAsync(entry.UserId);
        if (user is null)
            return Redirect(BuildFrontendErrorUrl("User account not found."));

        await signInManager.SignInAsync(user, isPersistent: true);
        return Redirect(BuildFrontendSuccessUrl(returnPath));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return Ok(new { message = "Logout successful." });
    }

    private bool IsGoogleConfigured() =>
        !string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientId"]) &&
        !string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientSecret"]);

    private string NormalizeReturnPath(string? returnPath) =>
        string.IsNullOrWhiteSpace(returnPath) || !returnPath.StartsWith('/')
            ? DefaultExternalReturnPath
            : returnPath;

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

    private static string GenerateToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private static void PurgeExpiredTokens()
    {
        var now = DateTime.UtcNow;
        foreach (var key in _pendingTokens.Keys)
        {
            if (_pendingTokens.TryGetValue(key, out var val) && now > val.Expiry)
                _pendingTokens.TryRemove(key, out _);
        }
    }
}
