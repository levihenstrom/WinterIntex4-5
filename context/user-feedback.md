# User Feedback — Site Review Session

**Tester profile:** Nonprofit program coordinator familiar with child welfare organizations; represents the staff/admin persona.

---

## 1. "There's so much information on the dashboard — I don't know what actually needs my attention right now."

The admin dashboard displays resident priority lists, donor churn scores, donation tables, and upcoming conferences all at once, but nothing visually signals urgency. The tester scanned the page for 30+ seconds and still couldn't identify what required immediate action. A flagged session note, a high-risk resident, and a routine metric all looked identical.

**Plan to change:**
- Add a dedicated high-priority alerts section at the top of the admin dashboard — styled in red/amber with icon badges — that surfaces only the items requiring immediate attention (high-risk residents, flagged session notes, overdue case conferences).
- Clicking a resident listed in the "Residents Needing Attention" widget should open that resident's profile modal in place, without navigating away from the dashboard.
- Color-code severity: red for critical, amber for attention needed, no color for informational.

---

## 2. "Some of these charts don't tell me anything useful — what am I supposed to do with this?"

On the reports and analytics pages, the tester stopped at several graphs (notably "By Contribution Type" and the Health & Wellbeing chart that duplicates header KPIs) and said they couldn't draw a useful conclusion from them. They described the pages as "busy" and said they would not revisit them because finding anything meaningful took too long.

**Plan to change:**
- Remove the "By Contribution Type" pie/bar chart — it adds no actionable signal.
- Remove the duplicate chart on the Health & Wellbeing card that restates the same numbers already shown in the header KPIs.
- Audit every graph on every report page: if a chart cannot be directly acted on, remove or replace it with a simpler metric pill.
- Replace "Lighthouse" with "Safehouse" everywhere in the UI so labels are generic and consistent.

---

## 3. "I clicked that number but nothing happened — I thought it was just a label."

The tester tapped several KPI cards expecting to drill into the underlying data and was surprised when nothing filtered. On the donations page specifically, they expected clicking the total amount card to filter the table to matching rows. On the admin dashboard, they expected clicking "Active Cases" to open the residents list pre-filtered to active status.

**Plan to change:**
- Every KPI card must navigate to — or filter — the relevant data it describes. Examples:
  - "Active Cases" → Residents list filtered to `caseStatus=Active`
  - "Session Notes" count → Session Notes page
  - A donations KPI → Donations table filtered to that segment
- On the allocations page, all safehouses must appear even at $0 (Safehouse 6 is currently missing), and labels should read "Safehouse 1", "Safehouse 2", etc. rather than named references.

---

## 4. "I couldn't find everything about this donor in one place — I kept getting sent somewhere else."

When asked to pull up a complete picture of a specific supporter, the tester navigated to three separate pages (supporter list, donations table, allocations) before giving up. There is no unified supporter profile. The tester said: "If I'm on a call with someone and they ask about their giving history, I need to see everything at once."

**Plan to change:**
- Build a single supporter profile page reachable by clicking any supporter name anywhere in the admin UI.
- The profile should consolidate: contact info, full donation history, allocation breakdown, ML churn risk score, outreach priority rank, and a notes/action log.
- On the donations table, group time-related columns under a "Time" column header and amount-related columns under a "Money" column header to reduce cognitive load when scanning.

---

## 5. "The donate button was hard to find — I scrolled right past it."

A secondary tester representing a prospective donor was shown the public-facing pages. They went to the impact page first looking for a way to give, couldn't find a clear entry point, and eventually landed on the donor page — but still had to scroll to the bottom before finding the donation widget. They also noted the impact page felt disconnected: "I don't know what I'm looking at or why it matters to me as a donor."

**Plan to change:**
- Move the "Donate Now" call-to-action above the fold on the donor page and add it as a persistent button in the public navigation bar.
- On the impact page, replace raw stat labels (e.g., "Reintegration Rate") with plain-language descriptions explaining what each metric means and why it matters to someone outside the organization.
- Add a consistent footer to all public pages (landing, impact, donor) — currently missing — so visitors have a stable navigation anchor at the bottom of every page.
