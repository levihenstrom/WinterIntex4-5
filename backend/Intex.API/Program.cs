using Microsoft.EntityFrameworkCore;
using Intex.API.Authorization;
using Intex.API.Data;
using Microsoft.AspNetCore.Identity;
using Intex.API.Infrastructure;
using Intex.API.Options;
using Intex.API.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Scalar.AspNetCore;

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

builder.Services.AddControllers();
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

builder.Services.AddOptions<MlInferenceServiceOptions>()
    .Bind(builder.Configuration.GetSection(MlInferenceServiceOptions.SectionName))
    .ValidateOnStart();
builder.Services.AddSingleton<Microsoft.Extensions.Options.IValidateOptions<MlInferenceServiceOptions>, MlInferenceServiceOptionsValidator>();

builder.Services.AddSingleton<MlArtifactService>();
builder.Services.AddHttpClient<MlSocialProxyService>((sp, client) =>
{
    var opt = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<MlInferenceServiceOptions>>().Value;
    var url = opt.BaseUrl?.Trim();
    if (string.IsNullOrEmpty(url))
        return;

    if (!Uri.TryCreate(url.EndsWith('/') ? url : url + "/", UriKind.Absolute, out var baseUri))
        return;

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

// Authorization policies
builder.Services.AddAuthorization(options =>
{
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

// Password policy
builder.Services.Configure<IdentityOptions>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequiredLength = 14;
    options.Password.RequiredUniqueChars = 1;
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

var app = builder.Build();

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

// Simple health check — use to verify the site and runtime without auth
app.MapGet("/health", () => Results.Json(new { status = "ok", utc = DateTime.UtcNow }));

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
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
