using Microsoft.EntityFrameworkCore;
using Intex.API.Data;
using Microsoft.AspNetCore.Identity;
using Intex.API.Infrastructure;
using Microsoft.AspNetCore.Authentication.Google;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
const string FrontendCorsPolicy = "FrontendClient";
const string DefaultFrontendUrl = "http://localhost:3000";
var frontendUrl = builder.Configuration["FrontendUrl"] ?? DefaultFrontendUrl;
var googleClientId = builder.Configuration["Authentication:Google:ClientId"];
var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"];

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Domain data context (SQLite for now — swap to UseSqlServer for Azure SQL later)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("AppConnection")));

// Identity context (separate DB)
builder.Services.AddDbContext<AuthIdentityDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("IdentityConnection")));

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

// Cookie auth config
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.SlidingExpiration = true;
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.WithOrigins(frontendUrl)
            .AllowCredentials()
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

var app = builder.Build();

// Seed roles + admin user
using (var scope = app.Services.CreateScope())
{
    await AuthIdentityGenerator.GenerateDefaultIdentityAsync(scope.ServiceProvider, app.Configuration);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseSecurityHeaders();
app.UseCors(FrontendCorsPolicy);
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGroup("/api/auth").MapIdentityApi<ApplicationUser>();
app.Run();
