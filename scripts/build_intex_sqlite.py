"""
Build backend/Intex.API/Intex.sqlite from data/lighthouse_csv_v7/*.csv
with foreign keys matching the INTEX data dictionary.

Usage:
  python scripts/build_intex_sqlite.py
      Create a new Intex.sqlite (drops existing): run DDL + load all CSVs.

  python scripts/build_intex_sqlite.py --data-only
      Use after `dotnet ef database update` on an EF-managed SQLite file:
      clears domain tables (preserves __EFMigrationsHistory) and reloads CSVs.
"""
from __future__ import annotations

import argparse
import csv
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_DIR = ROOT / "data" / "lighthouse_csv_v7"
OUT_DB = ROOT / "backend" / "Intex.API" / "Intex.sqlite"

DDL = """
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS public_impact_snapshots;
DROP TABLE IF EXISTS safehouse_monthly_metrics;
DROP TABLE IF EXISTS incident_reports;
DROP TABLE IF EXISTS intervention_plans;
DROP TABLE IF EXISTS health_wellbeing_records;
DROP TABLE IF EXISTS education_records;
DROP TABLE IF EXISTS home_visitations;
DROP TABLE IF EXISTS process_recordings;
DROP TABLE IF EXISTS residents;
DROP TABLE IF EXISTS donation_allocations;
DROP TABLE IF EXISTS in_kind_donation_items;
DROP TABLE IF EXISTS donations;
DROP TABLE IF EXISTS partner_assignments;
DROP TABLE IF EXISTS social_media_posts;
DROP TABLE IF EXISTS supporters;
DROP TABLE IF EXISTS partners;
DROP TABLE IF EXISTS safehouses;

CREATE TABLE safehouses (
  safehouse_id INTEGER PRIMARY KEY,
  safehouse_code TEXT NOT NULL,
  name TEXT,
  region TEXT,
  city TEXT,
  province TEXT,
  country TEXT,
  open_date TEXT,
  status TEXT,
  capacity_girls INTEGER,
  capacity_staff INTEGER,
  current_occupancy INTEGER,
  notes TEXT
);

CREATE TABLE partners (
  partner_id INTEGER PRIMARY KEY,
  partner_name TEXT,
  partner_type TEXT,
  role_type TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  region TEXT,
  status TEXT,
  start_date TEXT,
  end_date TEXT,
  notes TEXT
);

CREATE TABLE supporters (
  supporter_id INTEGER PRIMARY KEY,
  supporter_type TEXT,
  display_name TEXT,
  organization_name TEXT,
  first_name TEXT,
  last_name TEXT,
  relationship_type TEXT,
  region TEXT,
  country TEXT,
  email TEXT,
  phone TEXT,
  status TEXT,
  created_at TEXT,
  first_donation_date TEXT,
  acquisition_channel TEXT
);

CREATE TABLE social_media_posts (
  post_id INTEGER PRIMARY KEY,
  platform TEXT,
  platform_post_id TEXT,
  post_url TEXT,
  created_at TEXT,
  day_of_week TEXT,
  post_hour INTEGER,
  post_type TEXT,
  media_type TEXT,
  caption TEXT,
  hashtags TEXT,
  num_hashtags INTEGER,
  mentions_count INTEGER,
  has_call_to_action INTEGER,
  call_to_action_type TEXT,
  content_topic TEXT,
  sentiment_tone TEXT,
  caption_length INTEGER,
  features_resident_story INTEGER,
  campaign_name TEXT,
  is_boosted INTEGER,
  boost_budget_php REAL,
  impressions INTEGER,
  reach INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  click_throughs INTEGER,
  video_views INTEGER,
  engagement_rate REAL,
  profile_visits INTEGER,
  donation_referrals INTEGER,
  estimated_donation_value_php REAL,
  follower_count_at_post INTEGER,
  watch_time_seconds INTEGER,
  avg_view_duration_seconds INTEGER,
  subscriber_count_at_post INTEGER,
  forwards REAL
);

CREATE TABLE partner_assignments (
  assignment_id INTEGER PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(partner_id),
  safehouse_id INTEGER REFERENCES safehouses(safehouse_id),
  program_area TEXT,
  assignment_start TEXT,
  assignment_end TEXT,
  responsibility_notes TEXT,
  is_primary INTEGER NOT NULL,
  status TEXT
);

CREATE TABLE donations (
  donation_id INTEGER PRIMARY KEY,
  supporter_id INTEGER NOT NULL REFERENCES supporters(supporter_id),
  donation_type TEXT,
  donation_date TEXT,
  is_recurring INTEGER,
  campaign_name TEXT,
  channel_source TEXT,
  currency_code TEXT,
  amount REAL,
  estimated_value REAL,
  impact_unit TEXT,
  notes TEXT,
  referral_post_id INTEGER REFERENCES social_media_posts(post_id)
);

CREATE TABLE in_kind_donation_items (
  item_id INTEGER PRIMARY KEY,
  donation_id INTEGER NOT NULL REFERENCES donations(donation_id),
  item_name TEXT,
  item_category TEXT,
  quantity INTEGER,
  unit_of_measure TEXT,
  estimated_unit_value REAL,
  intended_use TEXT,
  received_condition TEXT
);

CREATE TABLE donation_allocations (
  allocation_id INTEGER PRIMARY KEY,
  donation_id INTEGER NOT NULL REFERENCES donations(donation_id),
  safehouse_id INTEGER NOT NULL REFERENCES safehouses(safehouse_id),
  program_area TEXT,
  amount_allocated REAL,
  allocation_date TEXT,
  allocation_notes TEXT
);

CREATE TABLE residents (
  resident_id INTEGER PRIMARY KEY,
  case_control_no TEXT,
  internal_code TEXT,
  safehouse_id INTEGER NOT NULL REFERENCES safehouses(safehouse_id),
  case_status TEXT,
  sex TEXT,
  date_of_birth TEXT,
  birth_status TEXT,
  place_of_birth TEXT,
  religion TEXT,
  case_category TEXT,
  sub_cat_orphaned INTEGER,
  sub_cat_trafficked INTEGER,
  sub_cat_child_labor INTEGER,
  sub_cat_physical_abuse INTEGER,
  sub_cat_sexual_abuse INTEGER,
  sub_cat_osaec INTEGER,
  sub_cat_cicl INTEGER,
  sub_cat_at_risk INTEGER,
  sub_cat_street_child INTEGER,
  sub_cat_child_with_hiv INTEGER,
  is_pwd INTEGER,
  pwd_type TEXT,
  has_special_needs INTEGER,
  special_needs_diagnosis TEXT,
  family_is_4ps INTEGER,
  family_solo_parent INTEGER,
  family_indigenous INTEGER,
  family_parent_pwd INTEGER,
  family_informal_settler INTEGER,
  date_of_admission TEXT,
  age_upon_admission TEXT,
  present_age TEXT,
  length_of_stay TEXT,
  referral_source TEXT,
  referring_agency_person TEXT,
  date_colb_registered TEXT,
  date_colb_obtained TEXT,
  assigned_social_worker TEXT,
  initial_case_assessment TEXT,
  date_case_study_prepared TEXT,
  reintegration_type TEXT,
  reintegration_status TEXT,
  initial_risk_level TEXT,
  current_risk_level TEXT,
  date_enrolled TEXT,
  date_closed TEXT,
  created_at TEXT,
  notes_restricted TEXT
);

CREATE TABLE process_recordings (
  recording_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id),
  session_date TEXT,
  social_worker TEXT,
  session_type TEXT,
  session_duration_minutes INTEGER,
  emotional_state_observed TEXT,
  emotional_state_end TEXT,
  session_narrative TEXT,
  interventions_applied TEXT,
  follow_up_actions TEXT,
  progress_noted INTEGER,
  concerns_flagged INTEGER,
  referral_made INTEGER,
  notes_restricted TEXT
);

CREATE TABLE home_visitations (
  visitation_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id),
  visit_date TEXT,
  social_worker TEXT,
  visit_type TEXT,
  location_visited TEXT,
  family_members_present TEXT,
  purpose TEXT,
  observations TEXT,
  family_cooperation_level TEXT,
  safety_concerns_noted INTEGER,
  follow_up_needed INTEGER,
  follow_up_notes TEXT,
  visit_outcome TEXT
);

CREATE TABLE education_records (
  education_record_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id),
  record_date TEXT,
  education_level TEXT,
  school_name TEXT,
  enrollment_status TEXT,
  attendance_rate REAL,
  progress_percent REAL,
  completion_status TEXT,
  notes TEXT
);

CREATE TABLE health_wellbeing_records (
  health_record_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id),
  record_date TEXT,
  general_health_score REAL,
  nutrition_score REAL,
  sleep_quality_score REAL,
  energy_level_score REAL,
  height_cm REAL,
  weight_kg REAL,
  bmi REAL,
  medical_checkup_done INTEGER,
  dental_checkup_done INTEGER,
  psychological_checkup_done INTEGER,
  notes TEXT
);

CREATE TABLE intervention_plans (
  plan_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id),
  plan_category TEXT,
  plan_description TEXT,
  services_provided TEXT,
  target_value REAL,
  target_date TEXT,
  status TEXT,
  case_conference_date TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE incident_reports (
  incident_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id),
  safehouse_id INTEGER NOT NULL REFERENCES safehouses(safehouse_id),
  incident_date TEXT,
  incident_type TEXT,
  severity TEXT,
  description TEXT,
  response_taken TEXT,
  resolved INTEGER,
  resolution_date TEXT,
  reported_by TEXT,
  follow_up_required INTEGER
);

CREATE TABLE safehouse_monthly_metrics (
  metric_id INTEGER PRIMARY KEY,
  safehouse_id INTEGER NOT NULL REFERENCES safehouses(safehouse_id),
  month_start TEXT,
  month_end TEXT,
  active_residents INTEGER,
  avg_education_progress REAL,
  avg_health_score REAL,
  process_recording_count INTEGER,
  home_visitation_count INTEGER,
  incident_count INTEGER,
  notes TEXT
);

CREATE TABLE public_impact_snapshots (
  snapshot_id INTEGER PRIMARY KEY,
  snapshot_date TEXT,
  headline TEXT,
  summary_text TEXT,
  metric_payload_json TEXT,
  is_published INTEGER,
  published_at TEXT
);

PRAGMA foreign_keys = ON;
"""


def parse_cell(column: str, raw: str | None) -> str | int | float | None:
    if raw is None:
        return None
    s = raw.strip()
    if s == "":
        return None
    if s in ("True", "False"):
        return 1 if s == "True" else 0
    # Integer IDs (CSV sometimes uses "8.0" for safehouse_id)
    if column.endswith("_id") or column in (
        "allocation_id",
        "recording_id",
        "visitation_id",
        "education_record_id",
        "health_record_id",
        "plan_id",
        "incident_id",
        "metric_id",
        "snapshot_id",
        "item_id",
        "assignment_id",
        "post_hour",
        "num_hashtags",
        "mentions_count",
        "caption_length",
        "session_duration_minutes",
        "quantity",
        "capacity_girls",
        "capacity_staff",
        "current_occupancy",
        "impressions",
        "reach",
        "likes",
        "comments",
        "shares",
        "saves",
        "click_throughs",
        "video_views",
        "profile_visits",
        "donation_referrals",
        "follower_count_at_post",
        "watch_time_seconds",
        "avg_view_duration_seconds",
        "subscriber_count_at_post",
        "active_residents",
        "process_recording_count",
        "home_visitation_count",
        "incident_count",
    ):
        try:
            return int(float(s))
        except ValueError:
            return s
    try:
        if "." in s or "e" in s.lower():
            return float(s)
        return int(s)
    except ValueError:
        return raw


# Delete order: children before parents (FK-safe with foreign_keys OFF).
_TABLE_DELETE_ORDER = [
    "public_impact_snapshots",
    "safehouse_monthly_metrics",
    "incident_reports",
    "intervention_plans",
    "health_wellbeing_records",
    "education_records",
    "home_visitations",
    "process_recordings",
    "residents",
    "donation_allocations",
    "in_kind_donation_items",
    "donations",
    "partner_assignments",
    "social_media_posts",
    "supporters",
    "partners",
    "safehouses",
]


def clear_domain_tables(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = OFF")
    for name in _TABLE_DELETE_ORDER:
        conn.execute(f'DELETE FROM "{name}"')
    conn.execute("PRAGMA foreign_keys = ON")


def load_csv(conn: sqlite3.Connection, table: str, filename: str) -> None:
    path = CSV_DIR / filename
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise SystemExit(f"No columns in {path}")
        cols = list(reader.fieldnames)
        placeholders = ",".join("?" * len(cols))
        sql = f'INSERT INTO "{table}" ({",".join(cols)}) VALUES ({placeholders})'
        rows = []
        for row in reader:
            rows.append([parse_cell(c, row.get(c)) for c in cols])
    conn.executemany(sql, rows)


_CSV_LOAD_ORDER = [
    ("safehouses", "safehouses.csv"),
    ("partners", "partners.csv"),
    ("supporters", "supporters.csv"),
    ("social_media_posts", "social_media_posts.csv"),
    ("partner_assignments", "partner_assignments.csv"),
    ("donations", "donations.csv"),
    ("in_kind_donation_items", "in_kind_donation_items.csv"),
    ("donation_allocations", "donation_allocations.csv"),
    ("residents", "residents.csv"),
    ("process_recordings", "process_recordings.csv"),
    ("home_visitations", "home_visitations.csv"),
    ("education_records", "education_records.csv"),
    ("health_wellbeing_records", "health_wellbeing_records.csv"),
    ("intervention_plans", "intervention_plans.csv"),
    ("incident_reports", "incident_reports.csv"),
    ("safehouse_monthly_metrics", "safehouse_monthly_metrics.csv"),
    ("public_impact_snapshots", "public_impact_snapshots.csv"),
]


def _load_all_csvs(conn: sqlite3.Connection) -> None:
    for table, fn in _CSV_LOAD_ORDER:
        load_csv(conn, table, fn)


def _print_table_counts(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY 1"
    )
    tables = [r[0] for r in cur.fetchall()]
    print("Tables:", ", ".join(tables))
    for t in tables:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        print(f"  {t}: {cur.fetchone()[0]} rows")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build or seed Intex.sqlite from CSVs.")
    parser.add_argument(
        "--data-only",
        action="store_true",
        help="Clear domain data and reload CSVs; keep EF __EFMigrationsHistory (run after dotnet ef database update).",
    )
    args = parser.parse_args()

    if not CSV_DIR.is_dir():
        raise SystemExit(f"CSV folder not found: {CSV_DIR}")

    OUT_DB.parent.mkdir(parents=True, exist_ok=True)

    if args.data_only:
        if not OUT_DB.is_file():
            raise SystemExit(
                f"Database not found: {OUT_DB}. Run `dotnet ef database update` first, or run this script without --data-only."
            )
        conn = sqlite3.connect(str(OUT_DB))
        try:
            clear_domain_tables(conn)
            _load_all_csvs(conn)
            conn.commit()
            _print_table_counts(conn)
        finally:
            conn.close()
        print(f"Seeded (data-only) {OUT_DB}")
        return

    if OUT_DB.exists():
        OUT_DB.unlink()

    conn = sqlite3.connect(str(OUT_DB))
    try:
        conn.executescript(DDL)
        conn.execute("PRAGMA foreign_keys = ON")
        _load_all_csvs(conn)
        conn.commit()
        _print_table_counts(conn)
    finally:
        conn.close()

    print(f"Wrote {OUT_DB}")


if __name__ == "__main__":
    main()
