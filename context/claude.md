# WinterIntex4-5 — Agent / contributor context

This file helps humans and coding agents **orient quickly**: what exists, how auth works, and **which files to read** to learn more.

## Project purpose

- **Course**: IS Core Winter 2026, Group 4-5 (Intex / INTECH).
- **Client**: HealingWings Sanctuary — a nonprofit managing safehouses for trafficking/abuse survivors in the Philippines.
- **End goal** (see `BUILDPLAN.md`): a deployed, secure full-stack web app covering donor management, resident case management, social media analytics, and ML-driven insights.
- **Current repo state**: **authentication and shell UI are implemented**; **domain data, all admin/donor pages, and ML pipelines are not yet built** (`AppDbContext` has no entities).

## Tech stack

| Layer | Technology |
|--------|------------|
| API | .NET 10, ASP.NET Core, EF Core, Identity API endpoints, Scalar (dev) |
| Auth DB | SQLite file `Identity.sqlite` (migrations run at startup) |
| App DB | SQLite file `App.sqlite` (empty context placeholder) |
| Frontend | React 18+, Vite, TypeScript, React Router, Bootstrap |
| Hosting (target) | Azure App Service (API), Azure Static Web Apps (frontend) |

## What works end-to-end today

- Email/password **register** and **login** (Identity endpoints under `/api/auth`).
- **MFA** (TOTP) via Identity `manage/2fa` — UI on `/mfa`.
- **Google OAuth**: challenge → callback → **redirect to frontend with `?authToken=`** → SPA calls **`POST /api/auth/exchange-token`** → session + optional **refresh token** stored in `localStorage` for browsers that block cross-site cookies.
- **`GET /api/auth/me`** for current user + roles.
- **`POST /api/auth/refresh-session`** to restore session using stored refresh token.
- **Logout** clears server session and invalidates refresh token when sent.
- **Privacy** page and **cookie consent** banner (frontend).
- **`GET /health`** on the API (no auth).

## Auth architecture (read this before changing flows)

1. **Development**: Vite proxies `/api` to the backend; cookies often work with `SameSite=Lax`.
2. **Production (split origins)**: Cookies use `SameSite=None; Secure`. Google OAuth still needs **correct absolute URLs**; the API uses **forwarded headers** so `Request.Scheme` is `https` behind Azure.
3. **OAuth mobile / strict browsers**: Backend does **not** rely only on cross-origin cookies. It issues a **short-lived one-time `authToken`** in the redirect URL; the React **`AuthTokenExchanger`** in `App.tsx` exchanges it and stores **`intex-session`** / **`intex-refresh-token`** in `localStorage` (see `authAPI.ts`).
4. **Roles**: `Admin` and `Customer` seeded via `AuthIdentityGenerator`; policy `ManagingCatalog` requires Admin (ready for future admin endpoints).

## Where to learn more (file map)

| Topic | Location |
|--------|-----------|
| API startup, CORS, Identity, migrations, health | `backend/Intex.API/Program.cs` |
| `me`, Google OAuth, `exchange-token`, `refresh-session`, `logout` | `backend/Intex.API/Controllers/AuthController.cs` |
| Identity roles, seed admin, policies | `backend/Intex.API/Data/Auth*.cs` |
| Domain DB (empty) | `backend/Intex.API/Data/AppDbContext.cs` |
| CSP / security headers | `backend/Intex.API/Infrastructure/SecurityHeaders.cs` |
| All fetch helpers, token storage keys | `frontend/src/lib/authAPI.ts` |
| Fallback production API URL | `frontend/src/api/IntextAPI.ts` (update when backend URL changes) |
| Routes, navbar, OAuth token handler | `frontend/src/App.tsx` |
| Session state | `frontend/src/context/AuthContext.tsx` |
| Cookie consent | `frontend/src/context/CookieConsentContext.tsx`, `components/CookieConsentBanner.tsx` |
| Build plan, layer order, domain models, ML pipelines | `BUILDPLAN.md` |
| Product backlog (Trello cards) | `product-backlog.md` |
| MoSCoW requirements table | `moscow.md` |
| Scaffold & deploy steps | `README.md` |

## Configuration agents should know

- **Backend**: `FrontendUrl` (single or multiple origins separated by `;` or `,`), `ConnectionStrings:AppConnection` / `IdentityConnection`, `Authentication:Google:*`, `GenerateDefaultIdentityAdmin` (local admin seed).
- **Frontend**: `VITE_API_BASE_URL` for production builds; if unset in prod build, code falls back to `IntextAPI.ts`’s `API_URL`.
- **Secrets**: never commit real Google keys or production passwords; use `dotnet user-secrets` locally and Azure App Settings in production.

## How to run locally

```bash
# Terminal 1
cd backend/Intex.API && dotnet run

# Terminal 2
cd frontend && npm install && npm run dev
```

- API: `https://localhost:5000` (Scalar at `/scalar/v1` in Development).
- SPA: `http://localhost:3000`.

## Suggested order for a new agent

1. Read this file and the **“What the app does today”** section in `README.md`.
2. Skim `plan.md` for scope and future work.
3. Trace **one happy path**: `Program.cs` → `AuthController` → `authAPI.ts` → `App.tsx`.
4. Before adding domain features: add models to `AppDbContext`, migrate, add controllers, then routes and pages in `frontend/`.

## Naming note

The file `frontend/src/api/IntextAPI.ts` (extra “t”) is the **deployed API base URL fallback** — not the full domain API surface yet.
