# HealingWings — Supporter & Operations Portal

## What this application is for

HealingWings is a **case-study web application** for a nonprofit that provides **safe housing and supportive services** to people rebuilding their lives after crisis. The system helps the organization **stay organized behind the scenes** and helps **supporters see how their generosity matters**.

In one place, teams can track **resident care** (sessions, visits, conferences), **fundraising** (donors, gifts, how money is allocated across programs and sites), and **outreach** (including public impact storytelling). Supporters get a **private view of their own giving** without seeing confidential case details.

---

## Who uses it — how the roles work

Everyone signs in with their own account. The **role** on that account decides which areas of the site are available.

### Donor

- **Purpose:** People and organizations who give time, money, or in-kind support.
- **What they can do:** Use the **supporter portal** to review their **personal donation history**, understand **impact at a high level**, and (for classroom or demo use) **record a simulated gift** that is saved like a real row in the system so dashboards and reports stay consistent.
- **What they cannot do:** They do **not** open resident files, staff notes, or full organizational reports. Their world is focused on **their relationship with HealingWings**, not on private case data.

### Staff

- **Purpose:** Day-to-day program and operations team members.
- **What they can do:** Use the **admin portal** to work with **resident records**, **counseling and process notes**, **home visits and case conferences**, **supporter profiles**, **donations and allocations**, **reports and analytics**, and related tools their organization enables for their login.
- **Typical distinction from Admin:** Staff carry out the work; they usually **do not** manage who has which system role (that is reserved for administrators).

### Admin

- **Purpose:** Trusted leaders or IT owners who govern access to the system.
- **What they can do:** Everything **Staff** can do, plus responsibilities such as **assigning roles** (Admin, Staff, or Donor) to user accounts so the right people see the right areas.
- **Why it matters:** Keeps **protected information** in staff hands while still allowing **donors** to self-serve their own giving story safely.

---

## A quick note on privacy

**Resident and case information** is sensitive. Only **Staff** and **Admin** accounts should reach those areas. **Donor** accounts are intentionally limited so supporters can engage with the mission **without** exposure to private case details.

---

## ML artifacts (bundled JSON / models)

Staff-facing ML features read exported files from `backend/Intex.API/App_Data/ml/`. To regenerate them locally from CSV under `data/lighthouse_csv_v7/`, run from the repo root:

```bash
python3 refresh_ml_artifacts.py
```

Nightly automation and manual **Actions** runs are described in [`docs/ML_NIGHTLY_REFRESH.md`](docs/ML_NIGHTLY_REFRESH.md).

---

*This repository also contains internal technical notes (for example `plan.md`, `claude.md`) for the development team; they are not required reading for understanding the product from a client or user perspective.*
