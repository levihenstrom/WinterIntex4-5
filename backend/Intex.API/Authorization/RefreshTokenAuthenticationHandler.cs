using System.Security.Claims;
using System.Text.Encodings.Web;
using Intex.API.Data;
using Intex.API.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Intex.API.Authorization;

public sealed class RefreshTokenAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    RefreshTokenStore refreshTokenStore,
    UserManager<ApplicationUser> userManager,
    IUserClaimsPrincipalFactory<ApplicationUser> claimsPrincipalFactory)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "RefreshToken";
    public const string CombinedSchemeName = "AppOrRefreshToken";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var authorization = Request.Headers[HeaderNames.Authorization].ToString();
        if (string.IsNullOrWhiteSpace(authorization)
            || !authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return AuthenticateResult.NoResult();
        }

        var token = authorization["Bearer ".Length..].Trim();
        if (string.IsNullOrWhiteSpace(token))
            return AuthenticateResult.NoResult();

        if (!refreshTokenStore.TryGetValidUserId(token, out var userId) || string.IsNullOrWhiteSpace(userId))
            return AuthenticateResult.Fail("Invalid or expired refresh token.");

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
            return AuthenticateResult.Fail("User account not found.");

        var principal = await claimsPrincipalFactory.CreateAsync(user);
        if (principal.Identity is not ClaimsIdentity identity)
            return AuthenticateResult.Fail("Unable to create the authenticated identity.");

        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name);
        return AuthenticateResult.Success(ticket);
    }
}
