# Product Backlog — HealingWings Sanctuary

**Product Owner:** Levi  
**Product Goal:** Build a secure, full-stack web application that enables HealingWings Sanctuary staff to manage resident cases, donor relations, and social media strategy — powered by ML insights — so no girl falls through the cracks and the organization stays funded.

---

## Epics (Labels)

| Label | Color |
|-------|-------|
| Public Pages | Green |
| Admin Portal | Blue |
| Donor Management | Orange |
| Case Management | Purple |
| Reports & Analytics | Teal |
| ML Pipelines | Yellow |
| Security | Red |
| Data / Backend | Gray |
| Deployment | Dark Blue |
| Polish / QA | Pink |

---

## Backlog Cards

### Data / Backend

---

**[DB-1] Import & model all 17 dataset tables (EF Core + PostgreSQL)**
- **Points:** 5
- **Description:** Create EF Core model classes for all 17 CSV tables across the three domains (Donor/Support, Case Management, Outreach). Add DbSet properties to AppDbContext, run migrations, seed from CSVs. This is the foundation everything else depends on.
- **Acceptance Criteria:**
  - All 17 tables have corresponding C# model classes with correct data types
  - `dotnet ef database update` succeeds cleanly
  - Database is seeded with provided CSV data
  - Relationships (FKs) match the data dictionary

---

**[DB-2] API controller scaffolding — CRUD for all major entities**
- **Points:** 5
- **Description:** Create controllers for Residents, Supporters/Donations, ProcessRecordings, HomeVisitations, CaseConferences, and SocialMediaPosts. Paginated GET endpoints + POST/PUT/DELETE protected by Admin role.
- **Acceptance Criteria:**
  - All GET endpoints return paginated results
  - CUD endpoints require `[Authorize(Policy = "ManagingCatalog")]`
  - Returns appropriate HTTP status codes

---

### Public Pages

---

**[PUB-1] Home / Landing Page**
- **Points:** 3
- **Description:** Modern, professional landing page introducing HealingWings Sanctuary — mission statement, key impact numbers, calls to action (donate, learn more, login).
- **Acceptance Criteria:**
  - Visible to unauthenticated users
  - Has a clear CTA button leading to login or donor info
  - Passes Lighthouse accessibility ≥ 90%
  - Responsive on mobile and desktop

---

**[PUB-2] Impact / Donor-Facing Dashboard (public)**
- **Points:** 3
- **Description:** Public-facing page showing anonymized, aggregated impact data: number of residents served, successful reintegrations, safehouse count, donation totals. Visualized with charts.
- **Acceptance Criteria:**
  - No PII visible
  - At least 2 data visualizations (charts/graphs)
  - Data pulled from live database via API

---

**[PUB-3] Login Page**
- **Points:** 2
- **Description:** Username/password login form with validation, error messages, and redirect to appropriate portal based on role.
- **Acceptance Criteria:**
  - Shows inline error on bad credentials
  - Redirects Admin to Admin Dashboard, Donor to donor view
  - Supports Google OAuth login button

---

**[PUB-4] Privacy Policy Page + Cookie Consent Banner**
- **Points:** 2
- **Description:** GDPR-compliant privacy policy customized for HealingWings (linked from footer). Fully functional cookie consent banner that persists user choice.
- **Acceptance Criteria:**
  - Privacy Policy linked from footer on every page
  - Cookie consent banner appears on first visit
  - Consent choice is stored and banner does not re-appear after acceptance
  - Policy content is customized (not generic boilerplate)

---

### Admin Portal

---

**[ADM-1] Admin Dashboard (command center)**
- **Points:** 3
- **Description:** High-level overview for authenticated staff: active resident count per safehouse, recent donations, upcoming case conferences, progress summaries. Eve and Adam's first screen after login.
- **Acceptance Criteria:**
  - Requires authentication
  - Displays live counts and summaries from DB
  - Upcoming conferences shown with dates
  - Links out to relevant detail pages

---

### Donor Management

---

**[DON-1] Supporter Profiles — view, create, edit**
- **Points:** 4
- **Description:** Full management of supporter profiles. Types: monetary donor, volunteer, skills contributor, social media advocate. Status: active/inactive. Searchable and filterable list view + detail/edit form.
- **Acceptance Criteria:**
  - Admin can create, edit, deactivate supporters
  - List view is searchable and filterable by type and status
  - Pagination on list view
  - Delete requires confirmation dialog

---

**[DON-2] Contribution Tracking — all types**
- **Points:** 4
- **Description:** Record and view all contribution types per supporter: monetary, in-kind, volunteer time, skills, and social media advocacy. Forms for logging new contributions.
- **Acceptance Criteria:**
  - Each contribution type has appropriate input fields
  - Contributions linked to supporter profile
  - History view shows all contributions for a supporter

---

**[DON-3] Donation Allocation View (by safehouse and program area)**
- **Points:** 3
- **Description:** Show how donations are allocated across safehouses and program areas. Admins can record allocations; view breakdowns in charts.
- **Acceptance Criteria:**
  - Allocation data visible per donation record
  - Visual breakdown (pie or bar chart) per safehouse
  - Admin can add/edit allocations

---

**[DON-4] Donor self-service view — own history + impact**
- **Points:** 2
- **Description:** Authenticated donor users can view their own donation history and see the impact their donations have had (anonymized resident outcome data linked to program areas they funded).
- **Acceptance Criteria:**
  - Donor role cannot see other donors' data
  - Shows donation history with dates and amounts
  - Shows impact metrics for funded program areas

---

### Case Management

---

**[CASE-1] Resident Profiles — Caseload Inventory**
- **Points:** 5
- **Description:** Core case management page. Full resident profile: demographics, case category and sub-categories (trafficked, physical abuse, neglected, etc.), disability info, family socio-demographic profile (4Ps, solo parent, indigenous, informal settler), admission details, referral info, assigned social workers, reintegration tracking.
- **Acceptance Criteria:**
  - Create, view, edit resident records
  - All fields from data dictionary captured
  - Filterable/searchable by status, safehouse, category, social worker
  - Pagination on list view
  - Delete requires confirmation dialog
  - Requires Admin auth

---

**[CASE-2] Process Recording — counseling session notes**
- **Points:** 4
- **Description:** Forms for entering and viewing dated counseling session notes per resident. Fields: session date, social worker, session type (individual/group), emotional state (start & end), narrative summary, interventions, follow-up actions. Full chronological history per resident.
- **Acceptance Criteria:**
  - New process recording form tied to a resident
  - Chronological history view per resident
  - Session type and emotional state use dropdown/select fields
  - Requires Admin auth

---

**[CASE-3] Home Visitation & Case Conference logging**
- **Points:** 4
- **Description:** Log home/field visits (type, home observations, family cooperation, safety concerns, follow-up). View case conference history and upcoming conferences per resident.
- **Acceptance Criteria:**
  - Visit types: initial assessment, routine follow-up, reintegration assessment, post-placement, emergency
  - Upcoming conferences shown with dates
  - History view chronologically ordered per resident
  - Requires Admin auth

---

### Reports & Analytics

---

**[REP-1] Donation Trends Report**
- **Points:** 3
- **Description:** Aggregated donation analytics: trends over time, by contribution type, by safehouse and program area, by donor segment.
- **Acceptance Criteria:**
  - Time-series chart of donation totals
  - Filter by date range, safehouse, and contribution type
  - Exportable or printable view

---

**[REP-2] Resident Outcomes & Reintegration Report**
- **Points:** 3
- **Description:** Resident outcome metrics: education progress, health improvements, safehouse performance comparisons, reintegration success rates. Aligned with Annual Accomplishment Report format (caring, healing, teaching domains).
- **Acceptance Criteria:**
  - At least 3 distinct metrics visualized
  - Safehouse comparison view
  - Reintegration success rate displayed

---

### ML Pipelines

---

**[ML-1] Donor Churn / Retention Predictor (predictive pipeline)**
- **Points:** 5
- **Description:** Predict which donors are at risk of lapsing. Full pipeline: problem framing, data prep from donor/donation tables, feature engineering, model training (classification), evaluation, deployment via API endpoint.
- **Acceptance Criteria:**
  - Notebook in `ml-pipelines/` folder, fully executable top-to-bottom
  - Predictive vs. explanatory approach explicitly stated
  - Train/test split with evaluation metrics reported in business terms
  - API endpoint serving predictions
  - Output visible in app (admin dashboard or donor management page)

---

**[ML-2] Resident Reintegration Readiness Scorer (predictive pipeline)**
- **Points:** 5
- **Description:** Score each resident's readiness for reintegration based on counseling progress, home visit outcomes, education and health records. Pipeline covers framing, prep, modeling, evaluation, deployment.
- **Acceptance Criteria:**
  - Notebook in `ml-pipelines/` folder
  - Score visible per resident in the caseload inventory
  - False positive/negative consequences for this context discussed
  - API endpoint serving scores

---

**[ML-3] Social Media Engagement Analyzer (explanatory pipeline)**
- **Points:** 4
- **Description:** Explain what content types, posting times, and platforms drive donor engagement and conversions. Explanatory model (regression or feature importance) on social media outreach tables.
- **Acceptance Criteria:**
  - Notebook in `ml-pipelines/` folder
  - Most impactful features identified with causal story
  - Honest discussion of correlation vs. causation limitations
  - Recommendations displayed in app (dashboard or analytics page)

---

**[ML-4] ML API integration + web app display**
- **Points:** 3
- **Description:** Wire all ML model outputs into the web app. Ensure predictions are visible in the UI — on admin dashboard, resident profiles, and donor management pages. At least one interactive tool (user inputs data, gets a prediction back).
- **Acceptance Criteria:**
  - At least 3 ML outputs visible in the deployed app
  - At least 1 API endpoint per model
  - Interactive form for at least one model

---

### Security

---

**[SEC-1] RBAC — Admin, Donor, Public roles + API protection**
- **Points:** 3
- **Description:** Configure all API endpoints with correct auth requirements. Admin can CUD all data. Donor can read own data. Unauthenticated users see only public pages. All unauthorized requests return 401/403.
- **Acceptance Criteria:**
  - All CUD endpoints require Admin role
  - Donor endpoints require Donor role
  - Unauthenticated requests to protected pages redirect to login
  - Verified in video for grading

---

**[SEC-2] Password policy hardening + delete confirmation dialogs**
- **Points:** 2
- **Description:** Configure ASP.NET Identity password policy stricter than defaults (as taught in class). Add confirmation dialog before any delete operation throughout the app.
- **Acceptance Criteria:**
  - Password policy configured as instructed in IS 414 lab
  - Every delete action shows a confirmation modal before executing
  - Verified in video

---

**[SEC-3] CSP HTTP header + full security headers**
- **Points:** 2
- **Description:** Configure Content-Security-Policy as an HTTP response header (not meta tag) with specific allowed sources. Verify in browser DevTools Network tab.
- **Acceptance Criteria:**
  - CSP header appears in DevTools response headers
  - No wildcard `*` sources unless justified
  - X-Content-Type-Options, Referrer-Policy also set

---

**[SEC-4] Credentials security — env vars, no secrets in repo**
- **Points:** 1
- **Description:** All credentials (DB connection strings, Google OAuth keys, admin seed passwords) stored in environment variables or Azure App Settings. Verify `.gitignore` covers all secret files.
- **Acceptance Criteria:**
  - No credentials in any committed file
  - `appsettings.json` contains no real secrets
  - Azure App Settings hold production credentials

---

### Deployment

---

**[DEP-1] Azure deployment — .NET API + React SPA + PostgreSQL**
- **Points:** 4
- **Description:** Deploy backend to Azure App Service, frontend to Azure Static Web Apps, database to Azure Database for PostgreSQL. Verify all auth flows work from production URLs.
- **Acceptance Criteria:**
  - Site is publicly accessible via HTTPS
  - HTTP → HTTPS redirect works
  - All auth flows work (login, OAuth, MFA) from production URL
  - Database is connected and seeded
  - Health endpoint returns 200

---

### Polish / QA

---

**[QA-1] Pagination + consistent look & feel throughout**
- **Points:** 2
- **Description:** Add pagination to all data-heavy list views. Ensure consistent branding: HealingWings logo, favicon, page titles, icon set, and color scheme applied uniformly.
- **Acceptance Criteria:**
  - All list views paginate at ≤ 20 rows
  - Browser tab titles are set on every page
  - Logo appears in navbar
  - Consistent font, spacing, and color scheme

---

**[QA-2] Lighthouse accessibility ≥ 90% + mobile responsiveness**
- **Points:** 2
- **Description:** Audit every page with Lighthouse and fix issues until all pages score ≥ 90% accessibility. Verify all pages resize correctly on mobile viewports.
- **Acceptance Criteria:**
  - Lighthouse accessibility ≥ 90 on every page
  - No horizontal scroll on 375px wide viewport
  - Key admin pages usable on tablet

---

## Summary

| Epic | Cards | Total Points |
|------|-------|-------------|
| Data / Backend | 2 | 10 |
| Public Pages | 4 | 10 |
| Admin Portal | 1 | 3 |
| Donor Management | 4 | 13 |
| Case Management | 3 | 13 |
| Reports & Analytics | 2 | 6 |
| ML Pipelines | 4 | 17 |
| Security | 4 | 8 |
| Deployment | 1 | 4 |
| Polish / QA | 2 | 4 |
| **Total** | **27** | **88** |
