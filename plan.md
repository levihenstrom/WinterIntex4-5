## INTECH (Intex) - Week Plan (No full rubric yet)

### Bottom line / what we are building

We will host a full web solution for a “Netflix-like” experience (example: recommendations) using:

- React frontend hosted on the web
- .NET 10 backend web application (Web API)
- Database for application + domain data (likely PostgreSQL or SQL Server)
- An ML pipeline that produces recommendations used by the backend
- Scrum + continuous reporting, delivered as a working demo by the end of the week

No deployment restrictions. We recommend deploying frontend + backend to Azure.

### Example concept (in case the task matches last year)

Movie/Media recommendation app:

- Frontend:
  - browse/search catalog (movies/media)
  - user profile / likes
  - recommendations feed (personalized list)
- Backend:
  - API endpoints for catalog, user preferences, recommendation retrieval
  - security/auth for users
  - stores metadata in the database (titles, genres, ratings/metrics, etc.)
- Database:
  - normalized tables for media items and user interactions/preferences
  - optionally: precomputed features or embeddings used by the ML pipeline
- ML pipeline:
  - training job that learns from user likes/interactions
  - output is a model and/or precomputed recommendation scores
  - backend serves recommendations from model output (or a cached precompute)

### Proposed architecture (high level)

1. React Frontend
  - calls backend via REST endpoints
  - handles user login/session (depending on auth approach)
  - displays catalog + recommendation results
2. .NET 10 Backend (Web API)
  - endpoints:
    - auth/session endpoints (if not handled by a managed provider)
    - catalog browsing endpoints
    - “user likes/preferences” endpoints
    - recommendations endpoints
  - recommendation flow:
    - request user -> determine “user profile vector” or look up precomputed scores
    - return ranked recommendations
3. Database
  - source-of-truth for catalog + user interactions/preferences
  - stores computed artifacts if needed (model metadata, feature tables, cached recommendation lists)
4. ML pipeline
  - training step(s) (offline during the week, or a scheduled job)
  - inference step(s) (either:
    - on-demand by backend, or
    - precompute and cache results in DB)

### Data / database plan (minimum viable schema)

We will design schema based on the eventual dataset/topic, but we need:

- “Primary entity” table (example: `MediaItem`)
  - id, title/name, basic metadata (genres/tags/etc.)
- “User” table or identity mapping (depending on auth)
  - user id, display name, etc.
- “Interaction/Preference” table
  - user id, item id, preference signal (like/dislike/rating/implicit event)
- “Recommendation output” storage (optional but likely helpful)
  - user id, recommended item id, score, timestamp/version

Decision we will make early:

- either compute recommendations dynamically, or
- train and precompute recommendation lists, then serve from DB.

### ML pipeline plan (what we must demonstrate)

We will implement an ML pipeline that is actually used by the web app. At minimum:

- Ingest:
  - use DB data (user interactions + item metadata)
  - produce training dataset features/labels
- Train:
  - create a model (or create recommendation scores using a reproducible algorithm)
  - save model artifacts (or save computed recommendation tables)
- Use:
  - backend uses the model artifacts or recommendation output to serve the UI
- Report:
  - document dataset assumptions, training procedure, evaluation approach (even if basic)

Candidate approach options (we will pick one fast, then improve if time):

- Collaborative filtering (matrix factorization / implicit feedback)
- Content-based recommender using item metadata + user preference weighting
- Hybrid approach (if we can do it without delaying delivery)

Example evaluation we can report:

- offline sanity checks (top-N accuracy proxy, coverage)
- or compare recommendation lists for different user profiles

### Scrum process + deliverables (work all week)

We will run Scrum-like development from Day 1:

- Roles (lightweight):
  - Product owner (clarifies requirements + keeps scope realistic)
  - Scrum master (tracks process + removes blockers)
  - Dev lead(s) (owns repo structure + integration points)
- Ceremonies:
  - Daily check-in (15 minutes): what we did / what we will do / blockers
  - Sprint planning at start of each day (or half-day)
  - End-of-day demo “working progress” (even if small)

Definition of Done (DoD) for each feature:

- Feature is in the repo and works end-to-end (frontend <-> backend <-> DB)
- Basic input validation + error handling are in place
- A short note is added to the plan or docs: what it does + how to test

Deliverables by end of week (must have):

- Live or easily runnable deployed frontend + backend
- Database is provisioned/connected
- At least one working recommendation flow driven by the ML pipeline
- Security basics implemented (auth/authz + secure secret handling)
- Report documenting:
  - what we built
  - key design choices
  - ML pipeline approach and how it feeds the app
  - what we would improve if we had more time

### Reporting expectations (what we will keep updated)

We will maintain short, frequent updates that include:

- Current working features
- Remaining work + planned integration steps
- Risks/blockers
- ML pipeline status (trained? artifacts saved? how backend uses it?)

We will also keep a “testing notes” section:

- how to log in / create a demo user
- how to trigger recommendation generation (if applicable)
- what endpoints are used by the frontend

### Security principles (must implement during build)

We will follow core security principles appropriate to a student project:

- Authentication and Authorization
  - do not trust client-side checks
  - ensure endpoints validate user identity/permissions
- Input validation and output encoding
  - validate request payloads server-side
  - sanitize/escape user-provided data in UI rendering paths
- Secret management
  - do not commit secrets (DB passwords, API keys, ML credentials)
  - use environment variables / Azure app settings
- Transport security
  - use HTTPS in production deployments
- Logging and error handling
  - avoid leaking secrets in logs/errors
  - log enough context to debug without exposing PII
- Principle of least privilege
  - use DB user with minimal required permissions
  - restrict what the backend can access
- Threat thinking (lightweight)
  - basic checks for common issues (broken auth, injection vectors)

Concrete tasks we will implement:

- protected endpoints for user-specific actions
- parameterized DB queries / ORM usage (avoid raw SQL string concatenation)
- consistent auth middleware in backend

### Deployment plan (recommended: Azure)

No deployment restrictions, so we choose the simplest path that works:

- Frontend:
  - deploy React build to a web hosting service (prefer Azure static hosting)
  - configure environment variables for backend base URL
- Backend:
  - deploy .NET 10 API to an Azure hosting service (web app)
  - configure:
    - DB connection string
    - any ML artifact/model path references
- Database:
  - provision Postgres or SQL Server in Azure
  - configure firewall/network settings as needed
- ML pipeline artifacts:
  - store model artifacts in a safe location (local app storage, blob storage, or DB)
  - backend loads artifacts at startup or on-demand (with caching if needed)

Decision point (early):

- Does ML run as:
  - a separate training job (script) that we run during the week, or
  - a pipeline triggered automatically (if time permits)?

### Week schedule (adapt as requirements become clear)

Day 1 (Kickoff / scope lock)

- confirm exact project requirements + rubric expectations (when released)
- choose domain + dataset shape (movie-like or alternative)
- decide DB choice + initial schema
- define API contract (frontend <-> backend endpoints)

Day 2 (Foundation)

- React app shell + routing + API integration skeleton
- .NET Web API skeleton with auth middleware (even if minimal)
- DB connectivity + migrations

Day 3 (Feature build)

- implement catalog browsing + preference/interaction capture
- implement basic recommendation endpoint that returns something deterministic first

Day 4 (ML pipeline integration)

- implement training pipeline and artifact saving
- backend reads artifacts and uses them for recommendations
- add “admin/dev” button or script path to re-train during testing

Day 5 (Polish + security + deployment)

- harden security checks + input validation
- add error handling + basic UX loading states
- deploy end-to-end to Azure

Day 6-7 (Buffer + report)

- improve recommendation quality / performance if time
- finalize reporting docs + demo script
- run a full test walkthrough: fresh deploy -> use -> see recommendations

### Risks / assumptions (we will track them)

- We do not know the exact task yet, so we will:
  - implement a generic “entity + interactions + recommendations” pattern
  - swap domain-specific naming/metadata later
- ML might be the hardest part:
  - we will use a simple baseline first, then improve
- Deployment time can be tight:
  - we will start Azure deployment early once backend runs locally

### Open questions (to answer when rubric/task arrives)

- What is the required domain (movies, products, content items, etc.)?
- Are we required to use a specific ML framework or data source?
- Do we need a specific evaluation metric or model explanation?
- Is authentication required, or only basic user-scoped personalization?
- What deployment target is preferred/allowed by the course?

### Success criteria (what “done” looks like)

- A user can interact with the app and see personalized recommendations
- Recommendations change when user preferences change
- ML pipeline is reproducible and documented
- Deployed solution works without manual local setup
- Security basics are implemented and documented

### Auth implementation runbook (.NET 10 + React template)

This is the concrete sequence we should follow this weekend when building the template app with security, MFA, and third-party auth.

1. Create backend foundation

- Create .NET 10 Web API project.
- Add EF Core + Identity packages.
- Create:
  - `ApplicationUser : IdentityUser`
  - `AuthIdentityDbContext : IdentityDbContext<ApplicationUser>`
- Register identity in `Program.cs` using Identity API endpoints.

1. Choose auth transport model early

- Use cookie-based auth for browser SPA (recommended for this template).
- Set strict cookie flags:
  - `HttpOnly = true`
  - `SecurePolicy = Always` in non-local envs
  - `SameSite = Lax` (or stricter if flow allows)
- Configure CORS allowlist for the React origin + `AllowCredentials`.

1. Map built-in identity endpoints

- Map identity API route group (for register/login/manage endpoints).
- Keep API path consistent (example: `/api/auth`).
- Confirm endpoint list for:
  - register, login, logout/session
  - password management
  - 2FA management

1. Add custom auth controller for SPA convenience

- Add endpoints like:
  - `GET /api/auth/me` (current user + role claims)
  - `GET /api/auth/providers` (external providers configured)
  - `GET /api/auth/external-login`
  - `GET /api/auth/external-callback`
  - `POST /api/auth/logout`
- Keep callback redirects locked to approved frontend routes only.

1. Add authorization model (RBAC + policies)

- Define role constants (`Admin`, `User/Customer`).
- Define policy constants (example: `ManageCatalog`).
- Add policy registrations in `Program.cs`.
- Protect sensitive endpoints with `[Authorize]` and policy checks.

1. Implement MFA (TOTP + recovery codes)

- Use Identity 2FA management endpoints.
- Frontend screens:
  - display MFA status
  - generate QR from shared key
  - verify code to enable MFA
  - reset/show recovery codes
  - disable MFA
- Test login with:
  - password only (before enable)
  - password + 2FA code
  - password + recovery code

1. Add third-party auth (Google first)

- Add external provider in backend auth config via client id/secret from secure config.
- Implement challenge/callback flow in custom auth controller.
- On callback:
  - sign in linked user if exists
  - otherwise create/link local user by verified identity/email policy
- Return to frontend success/error route with safe query flags.

1. React auth integration pattern

- Create centralized `authAPI` helper with `credentials: 'include'`.
- Create `AuthContext` that loads `/api/auth/me` at startup.
- Route guards:
  - auth required pages
  - role-required pages (admin)
- Login page supports:
  - email/password
  - MFA code and recovery code
  - external login buttons from `/api/auth/providers`

1. Security hardening defaults (must-have)

- No secrets in source (`appsettings.json` should not contain real credentials).
- Use env vars / secrets manager (local: user secrets; deploy: Azure settings/Key Vault).
- Enforce HTTPS + HSTS in non-development.
- Add security headers middleware (CSP + X-Content-Type-Options + Referrer-Policy, etc.).
- Configure lockout/sign-in hardening:
  - max failed attempts
  - lockout window
  - password policy decision documented
- Add CSRF mitigation strategy for cookie-based auth.
- Ensure DB access uses parameterized queries/ORM only.

1. Data + migration tasks

- Keep Identity schema migrations committed.
- Add app-domain DB context and migrations separately (if split contexts).
- Seed only non-sensitive defaults; bootstrap admin through secure one-time flow.

1. Verification checklist before deploy

- Register/login/logout works end-to-end.
- `/api/auth/me` returns accurate auth state + roles.
- MFA enable/disable and recovery flow works.
- External provider sign-in works from production URL.
- Protected endpoints reject unauthorized/forbidden requests properly.
- Browser cookie flags and CORS behavior are correct.

1. Deployment checklist (Azure)

- Backend app settings:
  - DB connection strings
  - external auth secrets
  - frontend origin allowlist
- Frontend env:
  - backend API base URL
- Database:
  - migrations applied
- Post-deploy smoke test:
  - auth flows + MFA + external login + role-protected API




deploy on azure, in backend run: dotnet publish -c Release -o ./publish