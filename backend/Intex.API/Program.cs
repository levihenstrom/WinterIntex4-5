using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Intex.API.Authorization;
using Intex.API.Data;
using Microsoft.AspNetCore.Identity;
using Intex.API.Infrastructure;
using Intex.API.Options;
using Intex.API.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Scalar.AspNetCore;
using Microsoft.AspNetCore.Authentication;

var builder = WebApplication.CreateBuilder(args);
var isDevelopment = builder.Environment.IsDevelopment();

// Azure App Service (and other reverse proxies) terminate TLS; without this, Request.Scheme
// stays "http" and Google OAuth builds redirect_uri as http://... → redirect_uri_mismatch.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor
        | ForwardedHeaders.XForwardedProto
        | ForwardedHeaders.XForwardedHost;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
const string FrontendCorsPolicy = "FrontendClient";
const string DefaultFrontendUrl = "http://localhost:3000";

// Semicolon or comma separated. Browsers send an exact Origin; include preview + production SWA URLs if needed.
static string[] ParseCorsOrigins(string? configured, string fallback)
{
    var raw = string.IsNullOrWhiteSpace(configured) ? fallback : configured!;
    return raw.Split([';', ','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(o => o.TrimEnd('/'))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();
}

var corsOrigins = ParseCorsOrigins(builder.Configuration["FrontendUrl"], DefaultFrontendUrl);
var googleClientId = builder.Configuration["Authentication:Google:ClientId"];
var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"];
var useSqliteInDevelopment = builder.Configuration.GetValue("Intex:UseSqliteInDevelopment", true);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(kvp => kvp.Value?.Errors.Count > 0)
            .ToDictionary(
                kvp => kvp.Key,
                kvp => kvp.Value!.Errors
                    .Select(error => string.IsNullOrWhiteSpace(error.ErrorMessage)
                        ? "The value is invalid."
                        : error.ErrorMessage)
                    .ToArray());

        return new BadRequestObjectResult(new ValidationProblemDetails(errors)
        {
            Title = "Request validation failed.",
            Status = StatusCodes.Status400BadRequest,
            Detail = "One or more request fields failed validation."
        });
    };
});
if (!isDevelopment)
{
    builder.Services.AddHostedService<IdentityBootstrapHostedService>();
}
builder.Services.AddScoped<StaffScopeResolver>();
builder.Services.AddSingleton<RefreshTokenStore>();

builder.Services.AddOptions<MlInferenceServiceOptions>()
    .Bind(builder.Configuration.GetSection(MlInferenceServiceOptions.SectionName))
    .ValidateOnStart();
builder.Services.AddSingleton<Microsoft.Extensions.Options.IValidateOptions<MlInferenceServiceOptions>, MlInferenceServiceOptionsValidator>();

// Local dev: user secrets / env sometimes leave BaseUrl empty; still allow FastAPI on 8001 without manual edits.
builder.Services.PostConfigure<MlInferenceServiceOptions>(opts =>
{
    if (string.IsNullOrWhiteSpace(opts.BaseUrl) && builder.Environment.IsDevelopment())
        opts.BaseUrl = MlInferenceBaseUrlHelper.DevelopmentFallbackBaseUrl;
});

builder.Services.AddSingleton<MlArtifactService>();
builder.Services.AddHttpClient<MlSocialProxyService>()
    .ConfigureHttpClient((sp, client) =>
    {
        var opt = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<MlInferenceServiceOptions>>().Value;
        var log = sp.GetRequiredService<ILogger<MlSocialProxyService>>();

        if (string.IsNullOrWhiteSpace(opt.BaseUrl?.Trim()))
        {
            log.LogInformation(
                "MlInferenceService:BaseUrl is not set; live social ML proxy is disabled (environment {Environment}).",
                sp.GetRequiredService<IHostEnvironment>().EnvironmentName);
            return;
        }

        if (!MlInferenceBaseUrlHelper.TryCreateHttpClientBaseUri(opt.BaseUrl, out var baseUri))
        {
            log.LogWarning(
                "MlInferenceService:BaseUrl is not a valid http(s) URL; live social ML proxy is disabled.");
            return;
        }

        client.BaseAddress = baseUri;
        client.Timeout = TimeSpan.FromSeconds(Math.Clamp(opt.TimeoutSeconds, 1, 300));

        if (!string.IsNullOrWhiteSpace(opt.ApiKey))
        {
            var headerName = string.IsNullOrWhiteSpace(opt.ApiKeyHeaderName)
                ? "X-ML-Service-Key"
                : opt.ApiKeyHeaderName.Trim();
            client.DefaultRequestHeaders.TryAddWithoutValidation(headerName, opt.ApiKey);
        }
    });

static bool IsSqliteConnectionString(string? connectionString) =>
    !string.IsNullOrWhiteSpace(connectionString)
    && connectionString.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase);

static string RequireProductionConnectionString(IConfiguration configuration, string name)
{
    var connectionString = configuration.GetConnectionString(name);
    if (string.IsNullOrWhiteSpace(connectionString))
        throw new InvalidOperationException($"ConnectionStrings:{name} must be configured in production.");

    if (IsSqliteConnectionString(connectionString))
        throw new InvalidOperationException($"ConnectionStrings:{name} cannot use SQLite in production.");

    return connectionString;
}

// Domain data context — SQLite for local development; SQL Server in production.
builder.Services.AddDbContext<AppDbContext>(options =>
{
    var cs = isDevelopment && useSqliteInDevelopment
        ? builder.Configuration.GetConnectionString("AppConnection") ?? "Data Source=Intex.sqlite"
        : RequireProductionConnectionString(builder.Configuration, "AppConnection");

    if (IsSqliteConnectionString(cs))
    {
        options.UseSqlite(cs);
    }
    else
    {
        options.UseSqlServer(cs, sqlOptions => sqlOptions.EnableRetryOnFailure());
    }
});

// Identity context — SQLite for local development; SQL Server in production.
builder.Services.AddDbContext<AuthIdentityDbContext>(options =>
{
    var cs = isDevelopment && useSqliteInDevelopment
        ? builder.Configuration.GetConnectionString("IdentityConnection") ?? "Data Source=Identity.sqlite"
        : RequireProductionConnectionString(builder.Configuration, "IdentityConnection");

    if (IsSqliteConnectionString(cs))
    {
        options.UseSqlite(cs);
    }
    else
    {
        options.UseSqlServer(cs, sqlOptions => sqlOptions.EnableRetryOnFailure());
    }
});

// Identity API endpoints + roles
builder.Services.AddIdentityApiEndpoints<ApplicationUser>()
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AuthIdentityDbContext>();

builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = RefreshTokenAuthenticationHandler.CombinedSchemeName;
        options.DefaultAuthenticateScheme = RefreshTokenAuthenticationHandler.CombinedSchemeName;
        options.DefaultChallengeScheme = RefreshTokenAuthenticationHandler.CombinedSchemeName;
    })
    .AddPolicyScheme(
        RefreshTokenAuthenticationHandler.CombinedSchemeName,
        "Identity cookie or refresh token",
        options =>
        {
            options.ForwardDefaultSelector = context =>
            {
                var hasBearerToken = context.Request.Headers.Authorization
                    .ToString()
                    .StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase);

                // Prefer the Identity application cookie whenever the browser sends it.
                // The SPA also stores an in-memory refresh token and sends Authorization: Bearer …
                // for mobile / no-cookie fallbacks, but RefreshTokenStore is process-local (singleton).
                // After an Azure restart or a different scale-out instance, that bearer becomes invalid
                // while the cookie can still be valid — forwarding Bearer first caused blanket 401s.
                // Default application cookie name: ".AspNetCore." + scheme ("Identity.Application").
                var applicationCookieName = CookieAuthenticationDefaults.CookiePrefix + IdentityConstants.ApplicationScheme;
                if (context.Request.Cookies.ContainsKey(applicationCookieName))
                    return IdentityConstants.ApplicationScheme;

                return hasBearerToken
                    ? RefreshTokenAuthenticationHandler.SchemeName
                    : IdentityConstants.ApplicationScheme;
            };
        })
    .AddScheme<AuthenticationSchemeOptions, RefreshTokenAuthenticationHandler>(
        RefreshTokenAuthenticationHandler.SchemeName,
        _ => { });

// Google OAuth (only if configured)
if (!string.IsNullOrEmpty(googleClientId) && !string.IsNullOrEmpty(googleClientSecret))
{
    builder.Services.AddAuthentication()
        .AddGoogle(options =>
        {
            options.ClientId = googleClientId;
            options.ClientSecret = googleClientSecret;
            options.SignInScheme = IdentityConstants.ExternalScheme;
            options.CallbackPath = "/signin-google";
        });
}

// Authorization policies — default deny: every endpoint requires authentication unless marked [AllowAnonymous].
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    options.AddPolicy(AuthPolicies.AdminOnly, policy => policy.RequireRole(AuthRoles.Admin));
    options.AddPolicy(
        AuthPolicies.StaffWrite,
        policy => policy.RequireRole(AuthRoles.Admin, AuthRoles.Staff));
    options.AddPolicy(
        AuthPolicies.StaffRead,
        policy => policy.RequireRole(AuthRoles.Admin, AuthRoles.Staff));
    options.AddPolicy(
        AuthPolicies.DonorSelfService,
        policy => policy.RequireRole(AuthRoles.Admin, AuthRoles.Donor, AuthRoles.LegacyCustomer));
});

// Password policy (stricter than Identity defaults) + account lockout after failed attempts (IS 414).
builder.Services.Configure<IdentityOptions>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequiredLength = 14;
    options.Password.RequiredUniqueChars = 1;

    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;
});

// Cookie auth: dev uses Lax (Vite proxy → same-origin /api). Production SPA + API on different
// registrable domains (azurestaticapps.net vs azurewebsites.net) requires None + Secure.
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None;
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.SlidingExpiration = true;
});

builder.Services.Configure<CookieAuthenticationOptions>(IdentityConstants.ExternalScheme, options =>
{
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None;
});

// Keep the temporary MFA sign-in cookie usable between cross-site SPA/API requests.
// Without this, GetTwoFactorAuthenticationUserAsync can return null immediately.
builder.Services.Configure<CookieAuthenticationOptions>(IdentityConstants.TwoFactorUserIdScheme, options =>
{
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None;
    options.ExpireTimeSpan = TimeSpan.FromMinutes(10);
});

builder.Services.Configure<CookieAuthenticationOptions>(IdentityConstants.TwoFactorRememberMeScheme, options =>
{
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None;
});

// CORS — endpoints must opt in with RequireCors(...) or [EnableCors] or the browser gets 200 without ACAO headers.
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.WithOrigins(corsOrigins)
            .AllowCredentials()
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

// HSTS for production HTTPS hardening (IS 414).
builder.Services.AddHsts(options =>
{
    options.Preload = false;
    options.IncludeSubDomains = true;
    options.MaxAge = TimeSpan.FromDays(180);
});

var app = builder.Build();

if (!isDevelopment)
{
    app.Logger.LogInformation(
        "CORS policy {Policy} allows origins: {Origins}. Set FrontendUrl in Azure App Settings if the SPA origin is missing.",
        FrontendCorsPolicy,
        string.Join("; ", corsOrigins));
}

{
    var mlOpt = app.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<MlInferenceServiceOptions>>().Value;
    var log = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Intex.API.Startup");
    if (MlInferenceBaseUrlHelper.TryCreateHttpClientBaseUri(mlOpt.BaseUrl, out var mlUri))
    {
        log.LogInformation(
            "MlInferenceService: live social proxy enabled → upstream host {Host} (environment {Environment}).",
            mlUri!.Host,
            app.Environment.EnvironmentName);
    }
    else if (string.IsNullOrWhiteSpace(mlOpt.BaseUrl?.Trim()))
    {
        log.LogInformation(
            "MlInferenceService: BaseUrl not set; live social ML disabled (environment {Environment}).",
            app.Environment.EnvironmentName);
    }
    else
    {
        log.LogWarning(
            "MlInferenceService: BaseUrl is set but is not a valid http(s) URL; live social ML disabled.");
    }
}

// Apply Identity + App domain migrations; optional CSV seed after migrate when DB is empty (see Intex:SeedCsvAfterMigrate).
using (var scope = app.Services.CreateScope())
{
    var sp = scope.ServiceProvider;
    var identityDb = sp.GetRequiredService<AuthIdentityDbContext>();
    var appDb = sp.GetRequiredService<AppDbContext>();
    var loggerFactory = sp.GetRequiredService<ILoggerFactory>();
    var seedLogger = loggerFactory.CreateLogger("Intex.Seed");

    if (isDevelopment)
    {
        if (identityDb.Database.IsSqlite())
            await identityDb.Database.EnsureCreatedAsync();
        else
            await identityDb.Database.MigrateAsync();

        if (appDb.Database.IsSqlite())
            await appDb.Database.EnsureCreatedAsync();
        else
            await appDb.Database.MigrateAsync();

        await AuthIdentityGenerator.GenerateDefaultIdentityAsync(sp, app.Configuration);
        await IntexDevSeedRunner.SeedAfterMigrateIfEmptyAsync(
            appDb,
            sp.GetRequiredService<IHostEnvironment>(),
            app.Configuration,
            seedLogger);
    }

    try
    {
        await CsvSeedRunner.SeedFromCsvIfConfiguredAsync(
            appDb,
            sp.GetRequiredService<IHostEnvironment>(),
            app.Configuration,
            seedLogger);
    }
    catch (Exception ex)
    {
        seedLogger.LogError(ex, "CSV seed failed. Application startup will continue.");
    }
}

app.UseForwardedHeaders();
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exceptionFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>()
            .CreateLogger("Intex.GlobalExceptionHandler");

        if (exceptionFeature?.Error is not null)
        {
            logger.LogError(
                exceptionFeature.Error,
                "Unhandled exception for {Method} {Path}",
                context.Request.Method,
                context.Request.Path);
        }

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;

        await Results.Problem(
            title: "An unexpected server error occurred.",
            detail: "The request could not be completed. Try again, and contact support if the problem persists.",
            statusCode: StatusCodes.Status500InternalServerError)
            .ExecuteAsync(context);
    });
});

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseSecurityHeaders();
app.UseHttpsRedirection();
app.UseRouting();
app.UseCors(FrontendCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

// Public endpoints (explicit opt-out of FallbackPolicy).
app.MapGet("/health", () => Results.Json(new { status = "ok", utc = DateTime.UtcNow }))
    .AllowAnonymous();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference().AllowAnonymous();
}

app.MapControllers().RequireCors(FrontendCorsPolicy);
app.MapGroup("/api/auth")
    .RequireCors(FrontendCorsPolicy)
    .MapIdentityApi<ApplicationUser>()
    .Add(endpointBuilder =>
    {
        if (endpointBuilder is RouteEndpointBuilder routeEndpointBuilder
            && routeEndpointBuilder.RoutePattern.RawText == "/register")
        {
            routeEndpointBuilder.Order = int.MaxValue;
        }
    });
app.Run();
