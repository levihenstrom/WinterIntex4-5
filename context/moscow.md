# MoSCoW Table — INTEX W26

## Must Have *(core requirements — project fails without these)*

| # | Requirement | Source |
|---|-------------|--------|
| 1 | Home / Landing page (professional, clear calls to action) | IS 413 |
| 2 | Impact / Donor-Facing Dashboard (public, anonymized data) | IS 413 |
| 3 | Login page (username/password with validation) | IS 413 |
| 4 | Privacy Policy page, linked from footer | IS 413 / IS 414 |
| 5 | GDPR-compliant cookie consent notification (fully functional) | IS 413 / IS 414 |
| 6 | Admin Dashboard (active residents, recent donations, upcoming conferences, summaries) | IS 413 |
| 7 | Donors & Contributions — view/create/manage supporter profiles, all contribution types, donation history, allocations | IS 413 |
| 8 | Caseload Inventory — resident profiles, demographics, case categories, disability info, referral info, filtering/searching | IS 413 |
| 9 | Process Recording — counseling session forms and full chronological history per resident | IS 413 |
| 10 | Home Visitation & Case Conferences — log visits, view history and upcoming conferences | IS 413 |
| 11 | Reports & Analytics — donation trends, outcome metrics, safehouse comparisons, reintegration rates | IS 413 |
| 12 | .NET 10 / C# backend | IS 413 |
| 13 | React / TypeScript (Vite) frontend | IS 413 |
| 14 | Relational database (Azure SQL, MySQL, or PostgreSQL) | IS 413 |
| 15 | App AND database deployed to cloud | IS 413 |
| 16 | Data validation and error handling throughout | IS 413 |
| 17 | Pagination on all data-heavy pages | IS 413 |
| 18 | HTTPS with valid TLS certificate | IS 414 |
| 19 | HTTP → HTTPS redirect | IS 414 |
| 20 | Username/password authentication via ASP.NET Identity | IS 414 |
| 21 | Password policy stricter than ASP.NET Identity defaults | IS 414 |
| 22 | All API endpoints have appropriate auth/authorization levels | IS 414 |
| 23 | RBAC: admin (CUD), donor (view own history), unauthenticated (public pages only) | IS 414 |
| 24 | Delete confirmation required before any data deletion | IS 414 |
| 25 | Credentials stored securely — not in code or public repos | IS 414 |
| 26 | Content-Security-Policy (CSP) HTTP header configured | IS 414 |
| 27 | Site publicly accessible (cloud deployed) | IS 414 |
| 28 | At least 1 predictive ML pipeline (end-to-end, reproducible notebook) | IS 455 |
| 29 | At least 1 explanatory ML pipeline (end-to-end, reproducible notebook) | IS 455 |
| 30 | ML model integrated into the web app (API endpoint + visible output) | IS 455 |
| 31 | All ML notebooks in `ml-pipelines/` folder, fully executable top-to-bottom | IS 455 |

---

## Should Have *(important — do after Must Haves are stable)*

| # | Requirement | Source |
|---|-------------|--------|
| 32 | ML pipelines covering all 3 domains: donor, case management, social media/outreach | IS 455 |
| 33 | Reports structured to align with Annual Accomplishment Report format | IS 413 |
| 34 | Lighthouse accessibility score ≥ 90% on every page | IS 401 |
| 35 | Every page responsive for desktop and mobile | IS 401 |
| 36 | Consistent look and feel: titles, icons, logo throughout | IS 413 |
| 37 | OKR metric tracked and displayed in the app | IS 401 |

---

## Could Have *(nice-to-have ideas from our team)*

| # | Idea | Rationale |
|---|------|-----------|
| 38 | Google OAuth / third-party SSO login | Reduces login friction for staff; already partially scaffolded |
| 39 | Two-factor / multi-factor authentication (TOTP) | Extra layer of protection for sensitive victim data |
| 40 | HTTP Strict Transport Security (HSTS) | Defense-in-depth; forces HTTPS even if user types http:// |
| 41 | Dark / light mode toggle stored in a browser-accessible cookie | Improves accessibility and personal preference for staff working long hours |
| 42 | Data sanitization on inputs + output encoding to prevent injection attacks | Reduces XSS/SQL injection risk beyond what EF Core provides by default |
| 43 | Docker container deployment instead of VM | Reproducible, portable deploys; easier to scale |
| 44 | Donor outreach personalization — ML-driven "who to contact next" suggestion on admin dashboard | Directly addresses client's donor retention pain point |

---

## Won't Have *(one feature we chose NOT to build)*

| # | Feature | Justification |
|---|---------|---------------|
| 45 | Native iOS / Android mobile app | The web app is fully responsive and covers all mobile use cases for staff in the field. Building and maintaining separate native codebases would consume time better spent on core case management and ML pipelines — which are the highest-value deliverables for this client. |

---

**Summary:** 31 Must Have · 6 Should Have · 7 Could Have · 1 Won't Have
