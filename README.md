# WinterIntex4-5

IS Core Winter 2026: Group 4-5

.NET 10 Web API + React (Vite/TypeScript) with ASP.NET Core Identity auth, MFA, Google OAuth, and Azure deployment.

---

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js 20+](https://nodejs.org/) (includes npm)
- [DB Browser for SQLite](https://sqlitebrowser.org/) (for inspecting/exporting data)
- [Azure Data Studio](https://learn.microsoft.com/en-us/azure-data-studio/) (for SQL Server deployment)
- An [Azure account](https://portal.azure.com) with an active subscription
- A [Google Cloud Console](https://console.cloud.google.com/) project (for OAuth)
- EF Core CLI: `dotnet tool install --global dotnet-ef`

---

## Part 1: Scaffold the Backend

### 1.1 Create the .NET Web API project

```bash
cd backend
dotnet new webapi -n Intex.API --framework net10.0
```

This creates `backend/Intex.API/`. All backend commands below run from `backend/Intex.API/`.

### 1.2 Install NuGet packages

```bash
cd Intex.API
dotnet add package Microsoft.EntityFrameworkCore --version 10.0.0
dotnet add package Microsoft.EntityFrameworkCore.Sqlite --version 10.0.0
dotnet add package Microsoft.EntityFrameworkCore.Design --version 10.0.0
dotnet add package Microsoft.EntityFrameworkCore.Tools --version 10.0.0
dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore --version 10.0.0
dotnet add package Microsoft.AspNetCore.Identity --version 2.3.9
dotnet add package Microsoft.AspNetCore.Authentication.Google --version 10.0.5
dotnet add package Scalar.AspNetCore
```

### 1.3 Delete the scaffold boilerplate

Remove the generated `WeatherForecast.cs` and `Controllers/WeatherForecastController.cs` files.

### 1.4 Create the Data layer

Create a `Data/` folder inside `Intex.API/`. Add these files:

**`Data/ApplicationUser.cs`**
```csharp
using Microsoft.AspNetCore.Identity;

namespace Intex.API.Data;

public class ApplicationUser : IdentityUser
{
    // Add additional user properties here later if needed
}
```

**`Data/AuthIdentityDbContext.cs`**
```csharp
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Data;

public class AuthIdentityDbContext : IdentityDbContext<ApplicationUser>
{
    public AuthIdentityDbContext(DbContextOptions<AuthIdentityDbContext> options) : base(options)
    {
    }
}
```

**`Data/AppDbContext.cs`** (domain data - empty for now, add DbSets per rubric)
```csharp
using Microsoft.EntityFrameworkCore;

namespace Intex.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    // Add DbSet<YourModel> properties here when you have the rubric
}
```

**`Data/AuthRoles.cs`**
```csharp
namespace Intex.API.Data;

public class AuthRoles
{
    public const string Admin = "Admin";
    public const string Customer = "Customer";
}
```

**`Data/AuthPolicies.cs`**
```csharp
namespace Intex.API.Data;

public class AuthPolicies
{
    public const string ManageCatalog = "ManagingCatalog";
}
```

**`Data/AuthIdentityGenerator.cs`** (seeds default roles + admin user at startup)
```csharp
using Microsoft.AspNetCore.Identity;

namespace Intex.API.Data;

public class AuthIdentityGenerator
{
    public static async Task GenerateDefaultIdentityAsync(
        IServiceProvider serviceProvider, IConfiguration configuration)
    {
        var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        foreach (var roleName in new[] { AuthRoles.Admin, AuthRoles.Customer })
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                var result = await roleManager.CreateAsync(new IdentityRole(roleName));
                if (!result.Succeeded)
                    throw new Exception($"Failed to create role '{roleName}': "
                        + string.Join(", ", result.Errors.Select(e => e.Description)));
            }
        }

        var adminSection = configuration.GetSection("GenerateDefaultIdentityAdmin");
        var adminEmail = adminSection["Email"] ?? "admin@intex.local";
        var adminPassword = adminSection["Password"] ?? "Intex2026!Admin";

        var adminUser = await userManager.FindByEmailAsync(adminEmail);
        if (adminUser == null)
        {
            adminUser = new ApplicationUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                EmailConfirmed = true
            };

            var createResult = await userManager.CreateAsync(adminUser, adminPassword);
            if (!createResult.Succeeded)
                throw new Exception("Failed to create admin user: "
                    + string.Join(", ", createResult.Errors.Select(e => e.Description)));
        }

        if (!await userManager.IsInRoleAsync(adminUser, AuthRoles.Admin))
        {
            var roleResult = await userManager.AddToRoleAsync(adminUser, AuthRoles.Admin);
            if (!roleResult.Succeeded)
                throw new Exception("Failed to assign admin role: "
                    + string.Join(", ", roleResult.Errors.Select(e => e.Description)));
        }
    }
}
```

### 1.5 Create the SecurityHeaders middleware

Create `Infrastructure/SecurityHeaders.cs`:

```csharp
namespace Intex.API.Infrastructure;

public static class SecurityHeaders
{
    public const string ContentSecurityPolicy =
        "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'";

    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    {
        var environment = app.ApplicationServices.GetRequiredService<IWebHostEnvironment>();
        return app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                if (!(environment.IsDevelopment() &&
                      context.Request.Path.StartsWithSegments("/swagger")))
                {
                    context.Response.Headers["Content-Security-Policy"] = ContentSecurityPolicy;
                }
                return Task.CompletedTask;
            });
            await next();
        });
    }
}
```

### 1.6 Create the AuthController

Create `Controllers/AuthController.cs`:

```csharp
using System.Security.Claims;
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

        var signInResult = await signInManager.ExternalLoginSignInAsync(
            info.LoginProvider, info.ProviderKey,
            isPersistent: false, bypassTwoFactor: true);

        if (signInResult.Succeeded)
            return Redirect(BuildFrontendSuccessUrl(returnPath));

        var email = info.Principal.FindFirstValue(ClaimTypes.Email)
                    ?? info.Principal.FindFirstValue("email");

        if (string.IsNullOrWhiteSpace(email))
            return Redirect(BuildFrontendErrorUrl("The external provider did not return an email address."));

        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true
            };

            var createResult = await userManager.CreateAsync(user);
            if (!createResult.Succeeded)
                return Redirect(BuildFrontendErrorUrl("Unable to create a local account for the external login."));
        }

        var addLoginResult = await userManager.AddLoginAsync(user, info);
        if (!addLoginResult.Succeeded)
            return Redirect(BuildFrontendErrorUrl("Unable to associate the external login with the local account."));

        await signInManager.SignInAsync(user, isPersistent: false, info.LoginProvider);
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
}
```

### 1.7 Wire up Program.cs

Replace the generated `Program.cs` with:

```csharp
using Microsoft.EntityFrameworkCore;
using Intex.API.Data;
using Microsoft.AspNetCore.Identity;
using Intex.API.Infrastructure;
using Microsoft.AspNetCore.Authentication.Google;

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
```

### 1.8 Configure appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "FrontendUrl": "http://localhost:3000",
  "ConnectionStrings": {
    "AppConnection": "Data Source=App.sqlite",
    "IdentityConnection": "Data Source=Identity.sqlite"
  },
  "GenerateDefaultIdentityAdmin": {
    "Email": "admin@intex.local",
    "Password": "Intex2026!Admin!!"
  }
}
```

> **IMPORTANT:** Do NOT put real secrets (Google OAuth keys, SQL Server passwords) in this file.
> Use `dotnet user-secrets` for local dev (see Part 4 below).

### 1.9 Configure launchSettings.json

Replace `Properties/launchSettings.json`:

```json
{
  "$schema": "http://json.schemastore.org/launchsettings.json",
  "profiles": {
    "default": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": true,
      "launchUrl": "scalar/v1",
      "applicationUrl": "https://localhost:5000;http://localhost:4000",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

### 1.10 Run Identity migrations

```bash
dotnet ef migrations add InitialIdentity --context AuthIdentityDbContext
dotnet ef database update --context AuthIdentityDbContext
```

This creates `Identity.sqlite` with all the ASP.NET Identity tables.

### 1.11 Test the backend

```bash
dotnet run
```

Open `https://localhost:5000/scalar/v1`. You should see:
- The Identity API endpoints under `/api/auth` (register, login, manage/2fa, etc.)
- Your custom `GET /api/auth/me`, `GET /api/auth/providers`, `POST /api/auth/logout`

Test in Scalar:
1. `POST /api/auth/register` with `{"email": "test@test.com", "password": "testpassword1234"}`
2. `POST /api/auth/login?useCookies=true` with `{"email": "test@test.com", "password": "testpassword1234"}`
3. `GET /api/auth/me` should return `isAuthenticated: true`

---

## Part 2: Scaffold the Frontend

### 2.1 Create the Vite + React + TypeScript project

```bash
cd ../../frontend
npm create vite@latest . -- --template react-ts
npm install
```

### 2.2 Install dependencies

```bash
npm install react-router-dom bootstrap qrcode @types/qrcode
npm install -D prettier eslint-config-prettier eslint-plugin-prettier
```

### 2.3 Configure Vite proxy

Replace `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

This proxies `/api/*` requests to the backend during local dev, so you don't need CORS workarounds.

### 2.4 Create types

**`src/types/AuthSession.ts`**
```ts
export interface AuthSession {
  isAuthenticated: boolean;
  userName: string | null;
  email: string | null;
  roles: string[];
}
```

**`src/types/TwoFactorStatus.ts`**
```ts
export interface TwoFactorStatus {
  sharedKey: string | null;
  recoveryCodesLeft: number;
  recoveryCodes: string[] | null;
  isTwoFactorEnabled: boolean;
  isMachineRemembered: boolean;
}
```

### 2.5 Create the auth API helper

**`src/lib/authAPI.ts`**

```ts
import type { AuthSession } from '../types/AuthSession';
import type { TwoFactorStatus } from '../types/TwoFactorStatus';

export interface ExternalAuthProvider {
  name: string;
  displayName: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

async function readApiError(response: Response, fallback: string): Promise<string> {
  const ct = response.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return fallback;
  const data = await response.json();
  if (typeof data?.detail === 'string' && data.detail.length > 0) return data.detail;
  if (typeof data?.title === 'string' && data.title.length > 0) return data.title;
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors).flat().find((v): v is string => typeof v === 'string');
    if (first) return first;
  }
  if (typeof data?.message === 'string' && data.message.length > 0) return data.message;
  return fallback;
}

async function postTwoFactorRequest(payload: object): Promise<TwoFactorStatus> {
  const response = await fetch(`${apiBaseUrl}/api/auth/manage/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readApiError(response, 'Unable to update MFA settings.'));
  return response.json();
}

export function buildExternalLoginUrl(provider: string, returnPath = '/'): string {
  const params = new URLSearchParams({ provider, returnPath });
  return `${apiBaseUrl}/api/auth/external-login?${params}`;
}

export async function getExternalProviders(): Promise<ExternalAuthProvider[]> {
  const response = await fetch(`${apiBaseUrl}/api/auth/providers`, { credentials: 'include' });
  if (!response.ok) throw new Error(await readApiError(response, 'Unable to load external login providers.'));
  return response.json();
}

export async function getAuthSession(): Promise<AuthSession> {
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to load auth session.');
  return response.json();
}

export async function registerUser(email: string, password: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await readApiError(response, 'Unable to register the account.'));
}

export async function loginUser(
  email: string, password: string, rememberMe: boolean,
  twoFactorCode?: string, twoFactorRecoveryCode?: string
): Promise<void> {
  const params = new URLSearchParams();
  if (rememberMe) params.set('useCookies', 'true');
  else params.set('useSessionCookies', 'true');

  const body: Record<string, string> = { email, password };
  if (twoFactorCode) body.twoFactorCode = twoFactorCode;
  if (twoFactorRecoveryCode) body.twoFactorRecoveryCode = twoFactorRecoveryCode;

  const response = await fetch(`${apiBaseUrl}/api/auth/login?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readApiError(response,
    'Unable to log in. If MFA is enabled, include an authenticator code or recovery code.'));
}

export async function logoutUser(): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error(await readApiError(response, 'Unable to log out.'));
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  return postTwoFactorRequest({});
}

export async function enableTwoFactor(code: string): Promise<TwoFactorStatus> {
  return postTwoFactorRequest({ enable: true, twoFactorCode: code, resetRecoveryCodes: true });
}

export async function disableTwoFactor(): Promise<TwoFactorStatus> {
  return postTwoFactorRequest({ enable: false });
}

export async function resetRecoveryCodes(): Promise<TwoFactorStatus> {
  return postTwoFactorRequest({ resetRecoveryCodes: true });
}
```

### 2.6 Create AuthContext

**`src/context/AuthContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getAuthSession } from '../lib/authAPI';
import type { AuthSession } from '../types/AuthSession';

interface AuthContextValue {
  authSession: AuthSession;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshAuthState: () => Promise<void>;
}

const anonymousSession: AuthSession = {
  isAuthenticated: false, userName: null, email: null, roles: [],
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authSession, setAuthSession] = useState<AuthSession>(anonymousSession);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuthState = useCallback(async () => {
    try {
      setAuthSession(await getAuthSession());
    } catch {
      setAuthSession(anonymousSession);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refreshAuthState(); }, [refreshAuthState]);

  return (
    <AuthContext.Provider value={{ authSession, isAuthenticated: authSession.isAuthenticated, isLoading, refreshAuthState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}
```

### 2.7 Create pages (Login, Register, Logout)

These are the auth pages. Create a `src/pages/` folder.

For reference implementations, copy the patterns from the RootkitIdentity example:
- `LoginPage.tsx` - email/password form + MFA code fields + external provider buttons
- `RegisterPage.tsx` - email/password/confirm form
- `LogoutPage.tsx` - calls logoutUser() and redirects
- `ManageMFAPage.tsx` - QR code display, enable/disable MFA, recovery codes

The exact code for these pages is in the example auth repo at:
`secondbrain/files/IS 414/exampleauthrepo/RootkitIdentityW26/frontend/src/pages/`

Adapt them by:
- Changing "Rootkit" references to your project name
- Changing default redirect paths (e.g., `/catalog` -> `/` or your home route)

### 2.8 Set up App.tsx with routing

```tsx
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LogoutPage from './pages/LogoutPage';
import ManageMFAPage from './pages/ManageMFAPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<div>Home - replace per rubric</div>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/logout" element={<LogoutPage />} />
          <Route path="/mfa" element={<ManageMFAPage />} />
          {/* Add domain routes here per rubric */}
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

### 2.9 Add Bootstrap to main.tsx

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

### 2.10 Test the full stack locally

Terminal 1 (backend):
```bash
cd backend/Intex.API
dotnet run
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`. Register, login, check `/mfa`.

---

## Part 3: Set Up Google OAuth

### 3.1 Create Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   - `https://localhost:5000/signin-google` (local dev)
   - `https://YOUR-AZURE-BACKEND-URL/signin-google` (production - add later)
7. Copy the **Client ID** and **Client Secret**

### 3.2 Store secrets locally (never in appsettings.json)

```bash
cd backend/Intex.API
dotnet user-secrets init   # only needed once - creates UserSecretsId in .csproj
dotnet user-secrets set "Authentication:Google:ClientId" "YOUR_CLIENT_ID"
dotnet user-secrets set "Authentication:Google:ClientSecret" "YOUR_CLIENT_SECRET"
```

### 3.3 Test Google login

1. Restart the backend
2. Visit `http://localhost:3000/login`
3. The "Continue with Google" button should appear
4. Clicking it redirects to Google, then back to your app

---

## Part 4: Deployment to Azure

Based on the IS 413 deployment videos (Water Project Phase 06).

### 4.1 Azure prerequisites

1. Go to [portal.azure.com](https://portal.azure.com) and sign in
2. Make sure you have an active subscription
3. Go to your subscription > **Resource providers** > search for **Microsoft.OperationalInsights** > click **Register** (prevents a common deployment error)

### 4.2 Deploy the backend (Azure App Service)

#### 4.2.1 Build for publish

```bash
cd backend/Intex.API
dotnet build
dotnet publish -c Release -o ./publish
```

> **SQLite users:** If deploying with a SQLite file, right-click the `.sqlite` file in Visual Studio/Rider > Properties > set **Copy to Output Directory** to **Copy if newer**. This prevents the file from being overwritten on each deploy.

#### 4.2.2 Deploy via VS Code Azure extension

1. Install the **Azure Tools** extension in VS Code
2. Click the Azure icon in the sidebar
3. Click **+** > **Create App Service Web App**
4. Name it (e.g., `intex-4-5-backend`)
5. Runtime stack: **.NET 10**
6. Pricing tier: **Free (F1)**
7. When prompted "Deploy?", click **Yes**
8. Select the `publish` folder
9. Wait for deployment to complete

#### 4.2.3 Test the deployed backend

Browse to `https://YOUR-BACKEND-URL.azurewebsites.net/api/auth/me` - should return `{ isAuthenticated: false, ... }`

### 4.3 Deploy the frontend (Azure Static Web Apps)

#### 4.3.1 Build the frontend

Before building, set the production API URL. Create `frontend/.env.production`:

```
VITE_API_BASE_URL=https://YOUR-BACKEND-URL.azurewebsites.net
```

```bash
cd frontend
npm run build
```

#### 4.3.2 Deploy via VS Code

1. In the Azure sidebar, click **+** > **Create Static Web App**
2. Sign in to GitHub when prompted (enables auto-deploy on push)
3. Name it (e.g., `intex-4-5-frontend`)
4. Region: pick the recommended one
5. Framework: **React**
6. App location: `frontend`
7. Build output location: `dist`
8. Wait for GitHub Actions to complete the deployment

#### 4.3.3 Update backend CORS

After getting your frontend URL (e.g., `https://zealous-sky-123.azurestaticapps.net`):

1. Update `appsettings.json` (or Azure App Settings) to set `FrontendUrl` to the production frontend URL
2. Rebuild and redeploy the backend:
   ```bash
   cd backend/Intex.API
   dotnet publish -c Release -o ./publish
   ```
3. In VS Code Azure sidebar, right-click the App Service > **Deploy to Web App** > select `publish` folder

#### 4.3.4 Update Google OAuth redirect URI

Add your production backend URL to the Google Cloud Console authorized redirect URIs:
```
https://YOUR-BACKEND-URL.azurewebsites.net/signin-google
```

### 4.4 (Optional) Switch to Azure SQL Server

When you're ready to move from SQLite to SQL Server for production:

#### 4.4.1 Create the Azure SQL Database

1. In Azure portal, go to **SQL databases** > **Create**
2. Name the database, create a new server if needed
3. Use **SQL authentication** (set admin username + password)
4. Apply the free offer if available (100K vCore seconds free)
5. Under **Networking**, set to **Public endpoint** and add your current IP to the firewall

#### 4.4.2 Export data from SQLite

1. Open your `.sqlite` file in DB Browser for SQLite
2. **File > Export > Database to SQL file**
3. Check "Keep column names in INSERT INTO"
4. Save the `.sql` file

#### 4.4.3 Convert SQLite SQL to SQL Server syntax

The exported SQL uses SQLite syntax. Use AI to convert it to SQL Server syntax (different data types, quoting, etc.).

#### 4.4.4 Import into Azure SQL

1. Open **Azure Data Studio**
2. Connect to your SQL Server using the admin credentials
3. Set **Trust server certificate** to true
4. Open a new query, paste the converted SQL, and run it
5. Verify with `SELECT TOP 100 * FROM YourTable`

#### 4.4.5 Update the backend to use SQL Server

Install the SQL Server EF Core package:
```bash
cd backend/Intex.API
dotnet add package Microsoft.EntityFrameworkCore.SqlServer --version 10.0.0
```

In `Program.cs`, change:
```csharp
// FROM:
options.UseSqlite(builder.Configuration.GetConnectionString("AppConnection"))
// TO:
options.UseSqlServer(builder.Configuration.GetConnectionString("AppConnection"))
```

#### 4.4.6 Update connection string

Get the connection string from Azure portal: your SQL database > **Settings > Connection strings** > copy the ADO.NET string.

Replace `{your_password}` in the connection string. Add `TrustServerCertificate=True`.

Set this in Azure App Service > **Configuration > Application settings** (do NOT put in source code).

#### 4.4.7 Set Azure SQL firewall

In the Azure portal, go to your SQL Server > **Set server firewall** > add your IP and any Azure service IPs.

#### 4.4.8 Redeploy

```bash
dotnet build
dotnet publish -c Release -o ./publish
```

Right-click App Service > Deploy to Web App.

### 4.5 Set production secrets in Azure

In Azure portal, go to your App Service > **Configuration > Application settings**. Add:

| Name | Value |
|------|-------|
| `Authentication:Google:ClientId` | your Google client ID |
| `Authentication:Google:ClientSecret` | your Google client secret |
| `FrontendUrl` | `https://your-frontend-url.azurestaticapps.net` |
| `ConnectionStrings:AppConnection` | your Azure SQL connection string (if using SQL Server) |
| `ConnectionStrings:IdentityConnection` | your Azure SQL identity connection string (if using SQL Server) |

---

## Part 5: When the Rubric Arrives

With this scaffold in place, you just need to:

1. **Add domain models** to `Data/` (e.g., `Movie.cs`, `UserInteraction.cs`)
2. **Add DbSets** to `AppDbContext`
3. **Run migrations**: `dotnet ef migrations add AddMovies --context AppDbContext`
4. **Add controllers** for your domain endpoints
5. **Protect endpoints** with `[Authorize]` or `[Authorize(Policy = AuthPolicies.ManageCatalog)]`
6. **Add frontend pages** and routes for the domain features
7. **Add the ML pipeline** output to the database and serve via API

---

## Quick Reference: Project Structure

```
WinterIntex4-5/
├── backend/
│   └── Intex.API/
│       ├── Controllers/
│       │   └── AuthController.cs
│       ├── Data/
│       │   ├── ApplicationUser.cs
│       │   ├── AuthIdentityDbContext.cs
│       │   ├── AuthIdentityGenerator.cs
│       │   ├── AuthPolicies.cs
│       │   ├── AuthRoles.cs
│       │   └── AppDbContext.cs
│       ├── Infrastructure/
│       │   └── SecurityHeaders.cs
│       ├── Properties/
│       │   └── launchSettings.json
│       ├── Program.cs
│       ├── appsettings.json
│       └── Intex.API.csproj
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── lib/
│   │   │   └── authAPI.ts
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── LogoutPage.tsx
│   │   │   └── ManageMFAPage.tsx
│   │   ├── types/
│   │   │   ├── AuthSession.ts
│   │   │   └── TwoFactorStatus.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
├── .gitignore
├── plan.md
└── README.md
```

## Quick Reference: Run Locally

```bash
# Terminal 1 - Backend
cd backend/Intex.API && dotnet run

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Backend: `https://localhost:5000` (Scalar API docs at `/scalar/v1`)
Frontend: `http://localhost:3000`
