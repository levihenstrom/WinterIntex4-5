# INTEX Video Walkthrough Checklist

Based on [`context/INTEX W26 Case.md`](/Users/levihenstrom/Desktop/BYU/IS%20Core/Winter%202025/Intex/WinterIntex4-5/context/INTEX%20W26%20Case.md).

Use this as a recording checklist so each class video shows exactly what graders need to award points. If a feature is implemented but not shown in the video, treat it as missing.

## General Recording Rules

- [ ] Record at a readable resolution.
- [ ] Keep each video focused on that class only.
- [ ] Show the live deployed app where applicable, not just local code.
- [ ] Narrate briefly what requirement is being shown and why it satisfies the rubric.
- [ ] If something is incomplete, say so directly instead of implying it is done.
- [ ] Verify the shared links are public/unlisted and accessible before submission.

## IS 413 Video Checklist

### Public pages

- [ ] Show the Home / Landing Page.
- [ ] Point out the organization mission and clear calls to action.
- [ ] Show the public Impact / Donor-Facing Dashboard.
- [ ] State that data is aggregated and anonymized.
- [ ] Show at least one or two visualizations on the impact page.
- [ ] Show the Login Page.
- [ ] Demonstrate validation and/or error handling on login.
- [ ] Show the Privacy Policy page.
- [ ] Show the Cookie Consent banner in action.

### Authenticated staff portal

- [ ] Log in as staff/admin on the deployed site.
- [ ] Show the Admin Dashboard.
- [ ] Point out active residents, recent donations, upcoming case conferences, and progress/summary data.
- [ ] Show Donors & Contributions.
- [ ] Show supporter profiles and classification/status fields.
- [ ] Show contribution tracking across types.
- [ ] Show donation allocations across safehouses and program areas.
- [ ] Show Caseload Inventory.
- [ ] Point out search/filtering and key resident fields.
- [ ] Show Process Recording.
- [ ] Show chronological resident session history.
- [ ] Show Home Visitation & Case Conferences.
- [ ] Show visit logging/history and upcoming conferences.
- [ ] Show Reports & Analytics.
- [ ] Point out donation trends, resident outcomes, safehouse comparisons, and reintegration-related reporting.

### App quality / technical expectations

- [ ] State that the app uses .NET 10 / C# backend and React / TypeScript (Vite) frontend.
- [ ] State that the app and database are deployed.
- [ ] Show at least one page persisting or reading live database data.
- [ ] Mention validation, error handling, pagination, and consistent branding/polish.
- [ ] If useful, show mobile responsiveness on one or two important pages.

## IS 414 Video Checklist

### HTTPS / deployment / availability

- [ ] Show the deployed site is publicly accessible.
- [ ] Show HTTPS in the browser address bar.
- [ ] Show HTTP redirects to HTTPS.
- [ ] Show a live health or availability endpoint if useful.

### Authentication / authorization

- [ ] Show username/password authentication working.
- [ ] Show public pages accessible while signed out.
- [ ] Show protected pages require authentication.
- [ ] Show APIs/pages are protected where needed.
- [ ] Show role-based behavior:
- [ ] Admin can add/update/delete where allowed.
- [ ] Donor can see donor history/impact only for their own account.
- [ ] Public users cannot access protected content.

### Password policy / integrity

- [ ] Show that weak passwords are rejected.
- [ ] State the password policy is stricter than defaults and implemented as taught in class.
- [ ] Show a delete confirmation before destructive actions.

### Credentials handling

- [ ] Explain where production secrets are stored.
- [ ] State that credentials are not committed to the public repo.
- [ ] If showing code, show safe config placeholders rather than real secrets.

### Privacy / cookies

- [ ] Show the privacy policy page linked from the footer.
- [ ] State the policy is customized for your site.
- [ ] Show the cookie consent banner.
- [ ] Show that the cookie consent is fully functional, not just cosmetic.
- [ ] Show the browser cookie used for consent in DevTools if you want explicit proof.

### CSP / headers

- [ ] Open DevTools Network tab.
- [ ] Click a frontend document response and show `Content-Security-Policy`.
- [ ] Click an API response and show `Content-Security-Policy`.
- [ ] Show `X-Content-Type-Options`.
- [ ] Show `X-Frame-Options`.
- [ ] Show `Referrer-Policy`.
- [ ] State that CSP is an HTTP header, not a meta tag.

### Additional security features

- [ ] Show Google or other third-party authentication.
- [ ] Show MFA / 2FA exists.
- [ ] State that at least one admin and one donor account do not require MFA for grading.
- [ ] Mention HSTS.
- [ ] Mention the browser-readable preference/consent cookie.
- [ ] Mention any other extra security/privacy features you added and why.

## IS 455 Video Checklist

### High-level ML overview

- [ ] State how many complete pipelines you built.
- [ ] State the business problem for each pipeline.
- [ ] State whether each pipeline is predictive or explanatory.
- [ ] Mention that each pipeline addresses a different business problem.

### For each pipeline shown

- [ ] Problem framing: what question is being answered and why it matters.
- [ ] Data acquisition/preparation: what tables were used and how data was cleaned/joined.
- [ ] Exploration: show at least a few meaningful findings from EDA.
- [ ] Modeling: show the model choice and why it fits the goal.
- [ ] Evaluation: show metrics and explain them in business terms.
- [ ] Feature selection / relationship analysis: explain what features mattered and why.
- [ ] Causation vs correlation: explicitly discuss limitations.
- [ ] Deployment: show where the model is integrated into the app.

### Deployment / integration proof

- [ ] Show model output in the web app for each pipeline.
- [ ] Show at least one API endpoint per model if applicable.
- [ ] Show at least one interactive prediction/recommendation tool if you built one.
- [ ] Point to the corresponding notebook(s) in the repo.
- [ ] State that the notebooks are executable top-to-bottom.

## Final Submission Checklist

- [ ] Website URL is correct.
- [ ] GitHub repo URL is correct and public.
- [ ] Notebook links are correct.
- [ ] IS 413 video link is correct and public/unlisted.
- [ ] IS 414 video link is correct and public/unlisted.
- [ ] IS 455 video link is correct and public/unlisted.

### Credentials to submit

- [ ] Admin account without MFA.
- [ ] Donor account without MFA and with donation history.
- [ ] One account with MFA enabled for testing.

## Suggested Video Order

### IS 413

1. Public pages
2. Login
3. Admin dashboard
4. Donor/contribution management
5. Case management
6. Reports/analytics
7. Deployment/live data note

### IS 414

1. Public access vs protected access
2. Login and RBAC
3. Password policy
4. Delete confirmation
5. Privacy policy and cookie consent
6. DevTools headers / CSP
7. HTTP to HTTPS redirect
8. Extra security features

### IS 455

1. Pipeline summary
2. Pipeline 1 walkthrough
3. Pipeline 2 walkthrough
4. Pipeline 3 walkthrough
5. Live app integration
6. Notebook/repo references

## Notes During Recording

- [ ] Mention exact features briefly, not just page names.
- [ ] If a requirement is easy to miss in the UI, zoom in or call it out verbally.
- [ ] Do not assume graders will infer anything from context.
- [ ] Prefer short proof clips over long narration.
