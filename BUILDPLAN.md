# Build Plan — What Exists vs What's Needed

## Current State (as of 2026-04-04)

### Done
- **Auth scaffold** — complete end-to-end: register, login, logout, MFA (TOTP + recovery), Google OAuth with mobile-safe token exchange, roles (Admin/Customer), policies (ManagingCatalog)
- **Security baseline** — CSP headers, secure cookie flags, CORS, HTTPS redirect, RBAC
- **Frontend shell** — React + Vite + TS + Bootstrap with routes: `/`, `/login`, `/register`, `/logout`, `/mfa`, `/privacy`
- **Cookie consent** + privacy page (GDPR-oriented)
- **Dual DB architecture** — Identity.sqlite (with migration) + App.sqlite (empty context ready)
- **Health endpoint** — `GET /health`

### Not Done (everything below)
- Domain models and database schema
- API endpoints for catalog, user interactions, recommendations
- Frontend pages for browsing, searching, user profiles, recommendations
- ML pipeline (training + artifact output)
- ML integration with backend
- Admin interface
- Azure deployment

---

## Layer 1: Data Foundation (do first)

**Goal:** Populate `AppDbContext` with domain models so every layer above has something to work with.

> **Note:** The actual domain is unknown until the rubric drops. Models below use generic placeholders (`Item`, `UserInteraction`, etc.). Swap in the real entity name (Movie, Product, Book, etc.) once confirmed — the structural pattern stays identical.

### Models to create in `backend/Intex.API/Models/`

```
Item                              <- primary catalog entity (Movie, Product, Book, etc.)
|- ItemId (int, PK)
|- Title (string, required)
|- Category (string)              <- domain-specific grouping (genre, type, tag, etc.)
|- Description (string)
|- ImageUrl (string, nullable)
+- [domain-specific fields]       <- add when rubric is known

UserInteraction                   <- user engagement signal (rating, purchase, like, etc.)
|- InteractionId (int, PK)
|- UserId (string, FK -> AspNetUsers)
|- ItemId (int, FK -> Item)
|- Signal (decimal)               <- rating 1-5, or boolean like/dislike
+- Timestamp (DateTime)

UserSavedItem                     <- wishlist / watchlist / cart / favorites
|- SavedItemId (int, PK)
|- UserId (string, FK)
|- ItemId (int, FK)
+- AddedAt (DateTime)

Recommendation                    <- precomputed by ML pipeline
|- RecommendationId (int, PK)
|- UserId (string, FK)
|- ItemId (int, FK)
|- Score (float)
|- ModelVersion (string)
+- GeneratedAt (DateTime)
```

### Steps
1. Create model classes in `backend/Intex.API/Models/`
2. Add `DbSet<>` properties to `AppDbContext`
3. Seed data: use `OnModelCreating` + `HasData()` for initial catalog rows (or import from CSV via a seed script once the dataset is known)
4. `dotnet ef migrations add DomainModels` + `dotnet ef database update`

**Reference patterns:**
- IS 413 Bookstore (Mission 11) — full EF Core + SQLite model-first with migrations, seed data
- IS 413 DateMe / Mission06 — `[Key]`, `[Required]`, data annotations
- IS 413 ScaffoldingFun — repository pattern if abstraction is needed later

---

## Layer 2: API Endpoints (do second)

**Goal:** CRUD for catalog + user interactions + recommendation retrieval.

### Controllers to create in `backend/Intex.API/Controllers/`

**ItemsController** (`/api/items`) — rename to match domain (MoviesController, ProductsController, etc.)
- `GET /api/items` — paginated list with optional filters (category, search)
- `GET /api/items/{id}` — single item detail
- `POST /api/items` — admin create `[Authorize(Policy = "ManagingCatalog")]`
- `PUT /api/items/{id}` — admin update `[Authorize(Policy = "ManagingCatalog")]`
- `DELETE /api/items/{id}` — admin delete `[Authorize(Policy = "ManagingCatalog")]`

**InteractionsController** (`/api/interactions`)
- `GET /api/interactions/mine` — current user's interactions `[Authorize]`
- `POST /api/interactions` — submit an interaction (rate, like, purchase) `[Authorize]`
- `PUT /api/interactions/{id}` — update
- `DELETE /api/interactions/{id}` — remove

**RecommendationsController** (`/api/recommendations`)
- `GET /api/recommendations` — personalized list for current user `[Authorize]`
- `GET /api/recommendations/popular` — fallback for anonymous/new users (cold start)

**AdminController** (`/api/admin`)
- `GET /api/admin/users` — list users `[Authorize(Roles = "Admin")]`
- `POST /api/admin/retrain` — trigger ML retrain (if applicable)

**Reference patterns:**
- IS 413 Bookstore — `[ApiController]`, `[Route("[controller]")]`, `ControllerBase`, `IEnumerable<T>` returns
- IS 413 Water Project — paginated API endpoint with CORS
- IS 413 development413.md — `[HttpGet("AllProjects")]` named endpoints

---

## Layer 3: Frontend Pages (do third, can parallel with Layer 2)

**Goal:** Catalog browsing, search, user profile, recommendation feed.

### Pages to create in `frontend/src/pages/`

| Page | Route | Description |
|------|-------|-------------|
| HomePage (rebuild) | `/` | Hero + featured recommendations + category rows |
| BrowsePage | `/browse` | Full catalog with search + filters |
| DetailPage | `/items/:id` | Item detail, user interaction widget (rate/save) |
| ProfilePage | `/profile` | User info, interaction history, saved items |
| AdminPage | `/admin` | Catalog CRUD table, user list (Admin only) |

### Components to create in `frontend/src/components/`

| Component | Purpose |
|-----------|---------|
| ItemCard | Thumbnail + title + signal — used in grids and carousels |
| ItemGrid | Responsive grid of ItemCards |
| CategoryRow | Horizontal scrollable row (Netflix-style) |
| SearchBar | Text input with debounced search |
| InteractionWidget | Rating stars / like button depending on domain |
| FilterPanel | Category, attribute filters |
| ProtectedRoute | Wrapper checking auth state before rendering |
| AdminRoute | ProtectedRoute + role check for Admin |

### API integration
- Create `frontend/src/api/itemsAPI.ts` — fetch helpers for all catalog/interaction/recommendation endpoints
- Use existing `authAPI.ts` pattern: `credentials: 'include'`, error handling

**Reference patterns:**
- IS 413 Bookstore — React Context for state, React Router, Bootstrap UI, Axios
- IS 401 DinoCamp — TanStack Query for server state (optional upgrade)
- IS 401 Reading Habit Tracker — mobile-first responsive patterns

---

## Layer 4: ML Pipeline (can parallel with Layers 2-3)

**Goal:** Train a recommendation model, output precomputed scores to the database.

### Architecture decision: **Precompute and store in DB**
- Python script writes to `App.sqlite` `Recommendation` table
- Backend reads from table — no Python runtime needed in production
- Retrain by re-running the script and updating the table

### Pipeline location: `ml/` directory at project root

```
ml/
|- requirements.txt          # pandas, numpy, sklearn, scipy, sqlite3
|- train.py                  # Main training script
|- data/                     # Raw data (CSV) + processed features
|- models/                   # Saved model artifacts (joblib)
+- README.md                 # How to run, what it does, evaluation
```

### Recommended approach: **Collaborative filtering (user-item matrix)**

1. **Data prep:** Build user-item interaction matrix from `UserInteraction` table
2. **Model:** Start with sklearn `NearestNeighbors` (item-based CF) or `TruncatedSVD` (matrix factorization)
   - Fallback: content-based using item category/metadata similarity
3. **Cold start:** For new users with no interactions, serve popular/trending items
4. **Output:** Write top-N recommendations per user to `Recommendation` table
5. **Evaluation:** Offline precision@K, coverage, and diversity metrics

### Integration with backend
- `train.py` connects directly to `App.sqlite`, reads `UserInteraction` + `Item`, writes to `Recommendation`
- Backend `RecommendationsController` reads `Recommendation` table — zero coupling to Python
- `ModelVersion` string tracks which model generated each batch

**Reference patterns:**
- IS 455 `predict_2026.py` — end-to-end prediction script template
- IS 455 `functions.py` — reusable EDA/cleaning utilities
- IS 455 Chapter 11 — sklearn Pipeline + ColumnTransformer pattern
- IS 455 Chapter 14 — ensemble methods if baseline needs improvement
- IS 455 machinelearning455.md — CRISP-DM process, evaluation metrics, deployment patterns

---

## Layer 5: Security Hardening (weave in throughout)

From IS 414 course knowledge and current gaps identified in `cybersecurity414.md`:

### Must-do before deploy
- [ ] Remove hardcoded admin credentials from config — use `dotnet user-secrets` locally, Azure App Settings in prod
- [ ] Configure lockout/sign-in hardening (max failed attempts, lockout window)
- [ ] CSRF strategy for cookie-auth state-changing requests (anti-forgery tokens or SameSite + custom header)
- [ ] Input validation on all new API endpoints (data annotations + `ModelState.IsValid`)
- [ ] Parameterized queries only (EF Core handles this, but verify any raw SQL)
- [ ] Rate limiting on auth + recommendation endpoints
- [ ] Full security headers: CSP (already done), X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- [ ] HTTPS + HSTS in production
- [ ] No secrets in source code — verify `.gitignore` covers `.sqlite`, `appsettings.Development.json`, user-secrets

### Should-do
- [ ] Email confirmation for registration
- [ ] Audit logging for admin actions
- [ ] CORS restricted to exact production frontend origin

**Reference patterns:**
- IS 414 OWASP Top 10 — broken access control, injection, security misconfiguration
- IS 414 Auth Lab (RootkitIdentityW26) — same Identity + cookie + RBAC stack, security gaps documented
- IS 414 skills list — CSP, XSS prevention, secrets management, RBAC

---

## Layer 6: Deployment (final)

### Azure setup
1. **Backend:** Azure App Service → `dotnet publish -c Release -o ./publish`
   - App Settings: `ConnectionStrings:AppConnection`, `ConnectionStrings:IdentityConnection`, `Authentication:Google:*`, `FrontendUrl`
   - Enable HTTPS, configure custom domain if needed
2. **Frontend:** Azure Static Web Apps → `npm run build`
   - Env: `VITE_API_BASE_URL` pointing to backend App Service URL
3. **Database:** SQLite files deployed with backend (or upgrade to Azure SQL/PostgreSQL for production scale)
4. **ML artifacts:** Run `train.py` locally, deploy updated `App.sqlite` with precomputed recommendations

### Post-deploy checklist
- [ ] Auth flows work (register, login, MFA, Google OAuth with production URLs)
- [ ] Catalog browsing + search works
- [ ] Interactions persist and update recommendations
- [ ] Admin can CRUD catalog items
- [ ] Protected endpoints reject unauthorized requests
- [ ] Health check passes

---

## Execution Order (for next week)

| Priority | Layer | Can Parallel? | Estimated Effort |
|----------|-------|---------------|-----------------|
| 1 | Data Foundation (models + migration + seed) | No — everything depends on this | Small |
| 2 | API Endpoints | Yes, with Layer 3 | Medium |
| 3 | Frontend Pages | Yes, with Layer 2 | Medium-Large |
| 4 | ML Pipeline | Yes, with Layers 2-3 | Medium |
| 5 | Security Hardening | Weave throughout | Small |
| 6 | Deployment | After 1-4 are working locally | Medium |

### Critical path
**Models → API → Frontend → Deploy.** ML pipeline can be built in parallel and plugs in via the `Recommendation` table contract.

### Team split suggestion (4-5 people)
- **1-2 people:** Backend (models + API + security)
- **1-2 people:** Frontend (pages + components + API integration)
- **1 person:** ML pipeline (train.py + evaluation + integration)
- **Everyone:** Deployment + testing at the end
