using Microsoft.EntityFrameworkCore;
using Intex.API.Data;
using Microsoft.AspNetCore.Identity;
using Intex.API.Infrastructure;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.HttpOverrides;
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

builder.Services.AddControllers();
builder.Services.AddOpenApi();

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
    var cs = isDevelopment
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
    var cs = isDevelopment
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
    options.AddPolicy(AuthPolicies.ManageCatalog, policy => policy.RequireRole(AuthRoles.Admin));
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
        await identityDb.Database.MigrateAsync();
        await appDb.Database.MigrateAsync();
        await IntexDevSeedRunner.SeedAfterMigrateIfEmptyAsync(
            appDb,
            sp.GetRequiredService<IHostEnvironment>(),
            app.Configuration,
            seedLogger);
    }

    await AuthIdentityGenerator.GenerateDefaultIdentityAsync(sp, app.Configuration);
}

// Simple health check — use to verify the site and runtime without auth
app.MapGet("/health", () => Results.Json(new { status = "ok", utc = DateTime.UtcNow }));

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseForwardedHeaders();

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
    .MapIdentityApi<ApplicationUser>();
app.Run();
