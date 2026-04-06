# Build Plan — HealingWings Sanctuary

## Current State (as of 2026-04-06)

### Done
- **Auth scaffold** — register, login, logout, MFA (TOTP + recovery codes), Google OAuth with mobile-safe token exchange, roles (Admin/Customer), policies (ManagingCatalog)
- **Security baseline** — CSP headers, secure cookie flags, CORS, HTTPS redirect, RBAC enforcement
- **Frontend shell** — React + Vite + TS + Bootstrap; routes: `/`, `/login`, `/register`, `/logout`, `/mfa`, `/privacy`
- **Cookie consent** + privacy page (GDPR-oriented)
- **Dual DB architecture** — `Identity.sqlite` (migrated) + `App.sqlite` (empty AppDbContext, ready for domain models)
- **Health endpoint** — `GET /health`

### Not Done (everything below)
- Domain models and PostgreSQL schema (17 tables from dataset)
- API controllers for all domain entities
- All frontend pages (admin dashboard, case management, donor management, reports, ML outputs)
- ML pipelines (3 notebooks in `ml-pipelines/`)
- Azure deployment (App Service + Static Web Apps + PostgreSQL)

---

## Layer 1: Data Foundation *(do first — everything depends on this)*

**Goal:** Populate `AppDbContext` with all 17 domain models and seed from provided CSVs.

### Three data domains from the dataset

**Donor & Support Domain**
- `Safehouse` — safehouse locations and metadata
- `Partner` — partner organizations
- `Supporter` — donors/volunteers (type: monetary, in-kind, time, skills, social media)
- `Donation` — individual donation records
- `DonationAllocation` — allocation of donations to safehouses/program areas

**Case Management Domain**
- `Resident` — full resident profile (demographics, case category, admission, referral, social worker)
- `FamilyProfile` — socio-demographic family info (4Ps, solo parent, indigenous, informal settler)
- `ProcessRecording` — counseling session notes (date, type, emotional state, narrative, interventions, follow-up)
- `HomeVisitation` — field/home visit logs (type, observations, safety concerns, follow-up)
- `CaseConference` — conference history and upcoming conferences per resident
- `EducationRecord` — resident education progress
- `HealthRecord` — health and wellbeing tracking
- `InterventionPlan` — intervention planning per resident
- `IncidentReport` — incident documentation

**Outreach & Communication Domain**
- `SocialMediaPost` — posts across platforms with engagement metrics
- `OutreachCampaign` — campaign records
- `ImpactSnapshot` — public-facing impact summary data

### Steps
1. Create model classes in `backend/Intex.API/Models/` matching data dictionary
2. Add `DbSet<>` for each model in `AppDbContext`
3. Seed from CSVs via `OnModelCreating` + `HasData()` or a seed script
4. Switch `ConnectionStrings:AppConnection` to PostgreSQL (Azure Database for PostgreSQL in prod)
5. `dotnet ef migrations add DomainModels` + `dotnet ef database update`

---

## Layer 2: API Endpoints *(do second)*

**Goal:** CRUD for all domain entities with proper auth/authorization.

### Controllers in `backend/Intex.API/Controllers/`

| Controller | Key Endpoints | Auth |
|-----------|---------------|------|
| `ResidentsController` | GET (paginated, filtered), GET/{id}, POST, PUT, DELETE | Admin only (CUD), authenticated (R) |
| `ProcessRecordingsController` | GET by resident, POST, PUT, DELETE | Admin only |
| `HomeVisitationsController` | GET by resident, POST, PUT, DELETE | Admin only |
| `CaseConferencesController` | GET by resident (upcoming + history), POST, PUT, DELETE | Admin only |
| `SupportersController` | GET (paginated, filtered), GET/{id}, POST, PUT, DELETE | Admin only (CUD) |
| `DonationsController` | GET all, GET by supporter, POST, PUT, DELETE | Admin (CUD), Donor (own history R) |
| `DonationAllocationsController` | GET by donation, POST, PUT | Admin only |
| `ReportsController` | GET donation trends, GET outcome metrics | Authenticated |
| `SocialMediaController` | GET posts/metrics, POST, PUT | Admin only |
| `MLController` | GET donor churn scores, GET reintegration scores, GET social media recommendations | Authenticated |

All CUD operations require `[Authorize(Policy = "ManagingCatalog")]` or `[Authorize(Roles = "Admin")]`.

---

## Layer 3: Frontend Pages *(can parallel with Layer 2)*

**Goal:** All pages described in IS 413 requirements, connected to live API.

### Pages in `frontend/src/pages/`

| Page | Route | Auth | Description |
|------|-------|------|-------------|
| `LandingPage` | `/` | Public | Mission, impact numbers, CTAs |
| `ImpactDashboard` | `/impact` | Public | Anonymized aggregated impact data + charts |
| `LoginPage` | `/login` | Public | Email/password + Google OAuth button |
| `PrivacyPage` | `/privacy` | Public | GDPR privacy policy |
| `AdminDashboard` | `/admin` | Admin | Command center — residents, donations, conferences |
| `ResidentsPage` | `/admin/residents` | Admin | Caseload inventory with search/filter |
| `ResidentDetailPage` | `/admin/residents/:id` | Admin | Full profile + process recordings + visits |
| `ProcessRecordingForm` | `/admin/residents/:id/recordings/new` | Admin | New counseling session entry |
| `HomeVisitationForm` | `/admin/residents/:id/visits/new` | Admin | New visit log entry |
| `SupportersPage` | `/admin/supporters` | Admin | Donor/supporter list |
| `SupporterDetailPage` | `/admin/supporters/:id` | Admin | Profile + contribution history |
| `ReportsPage` | `/admin/reports` | Admin | Donation trends + outcome metrics |
| `MLInsightsPage` | `/admin/ml` | Admin | Donor churn scores, reintegration readiness, social media recommendations |
| `DonorPortalPage` | `/donor` | Donor | Own donation history + impact view |

### Key components in `frontend/src/components/`

- `DeleteConfirmModal` — reusable confirmation dialog (required for all delete operations)
- `PaginatedTable` — sortable, filterable table with pagination
- `StatCard` — metric display card for dashboards
- `ChartWidget` — wrapper around charting library for reports and ML outputs
- `CookieConsentBanner` — already exists

---

## Layer 4: ML Pipelines *(can parallel with Layers 2–3)*

**Goal:** Three end-to-end notebooks in `ml-pipelines/`, each integrated into the web app.

### Pipeline 1 — Donor Churn / Retention Predictor (predictive)
- **File:** `ml-pipelines/donor-churn-predictor.ipynb`
- **Business question:** Which donors are at risk of lapsing in the next 6 months?
- **Key tables:** Supporter, Donation, DonationAllocation, OutreachCampaign
- **Approach:** Classification (logistic regression or random forest)
- **Output:** Risk score per donor → stored in DB → served via `/api/ml/donor-churn`
- **App integration:** Flag at-risk donors in SupportersPage; summary on AdminDashboard

### Pipeline 2 — Resident Reintegration Readiness (predictive)
- **File:** `ml-pipelines/reintegration-readiness.ipynb`
- **Business question:** Which residents are ready for reintegration or at risk of regression?
- **Key tables:** Resident, ProcessRecording, HomeVisitation, EducationRecord, HealthRecord, InterventionPlan
- **Approach:** Classification or scoring model
- **Output:** Readiness score per resident → stored in DB → served via `/api/ml/reintegration`
- **App integration:** Score badge on ResidentDetailPage

### Pipeline 3 — Social Media Engagement Analyzer (explanatory)
- **File:** `ml-pipelines/social-media-analyzer.ipynb`
- **Business question:** What content type, platform, and timing drives donor engagement?
- **Key tables:** SocialMediaPost, OutreachCampaign, Donation (as outcome)
- **Approach:** OLS regression or feature importance (explanatory, interpretable model)
- **Output:** Feature importance + strategic recommendations → served via `/api/ml/social-insights`
- **App integration:** MLInsightsPage shows top recommendations

### All notebooks must
- Live in `ml-pipelines/` at repo root
- Be fully executable top-to-bottom
- Follow the 6-section structure (Problem Framing → Data Prep → Exploration → Modeling → Evaluation → Deployment Notes)
- Explicitly state predictive vs. explanatory goal

---

## Layer 5: Security Hardening *(weave in throughout)*

### Must-do before deploy
- [ ] Password policy configured as taught in IS 414 lab (stricter than Identity defaults)
- [ ] All API endpoints audited — CUD requires Admin, read-only varies by sensitivity
- [ ] Delete confirmation modal on every delete operation
- [ ] Credentials in Azure App Settings only — verify `.gitignore` covers `.sqlite`, `appsettings.Development.json`
- [ ] Input validation on all new API endpoints (`ModelState.IsValid`, data annotations)
- [ ] CSP header verified in DevTools Network tab
- [ ] HTTPS enforced + HTTP redirect active

### Should-do
- [ ] HSTS enabled in production Azure deployment
- [ ] Rate limiting on auth endpoints
- [ ] Audit logging for admin CUD actions

---

## Layer 6: Deployment

### Azure setup
1. **Database:** Provision Azure Database for PostgreSQL → update `AppConnection` connection string
2. **Backend:** Azure App Service
   - `dotnet publish -c Release -o ./publish`
   - App Settings: `ConnectionStrings:AppConnection`, `ConnectionStrings:IdentityConnection`, `Authentication:Google:*`, `FrontendUrl`
3. **Frontend:** Azure Static Web Apps
   - `npm run build`
   - Env: `VITE_API_BASE_URL` = backend App Service URL
4. **ML artifacts:** Run notebooks locally, store scores in DB before deploy

### Post-deploy checklist
- [ ] All auth flows work from production URL (login, OAuth, MFA)
- [ ] Protected pages reject unauthenticated requests
- [ ] Delete confirmations work
- [ ] ML scores visible in app
- [ ] CSP header present in DevTools
- [ ] HTTP → HTTPS redirect confirmed
- [ ] Health endpoint returns 200

---

## Execution Order

| Priority | Layer | Parallel? | Owner |
|----------|-------|-----------|-------|
| 1 | Data Foundation (models + migration + seed) | No | Backend |
| 2 | API Endpoints | Yes with Layer 3 | Backend |
| 3 | Frontend Pages | Yes with Layer 2 | Frontend |
| 4 | ML Pipelines | Yes with Layers 2–3 | ML |
| 5 | Security Hardening | Weave throughout | Everyone |
| 6 | Deployment | After 1–4 working locally | Everyone |
