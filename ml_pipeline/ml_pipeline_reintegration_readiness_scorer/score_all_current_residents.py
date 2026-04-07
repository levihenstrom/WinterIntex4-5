"""
Score all active residents using each resident's latest time-aware snapshot (no retraining).

Priority = lowest readiness score first (rank 1 = highest need for support), because the score is
estimated P(successful reintegration in the next 60 days) — lower values imply lower modeled
likelihood of timely success and more intensive support may be warranted.

TODO: Explanatory text uses logistic coefficient directions; if clinical review finds mismatches,
refresh training data or adjust the explanatory model — do not block operational scoring.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from . import config
from .data_prep import load_tables, parse_datetime_columns
from .feature_engineering import build_snapshot_frame
from .inference_explain import build_inference_payload
from .operational_interpretation import (
    INTERPRETATION_NOTE_SHORT,
    cohort_readiness_percentile,
    operational_band_for_group,
    raw_score_note,
    score_compression_diagnostics,
    support_priority_group_from_rank,
)


def _active_resident_ids(residents: pd.DataFrame) -> set[int]:
    """
    Operational definition of current/active residents for prioritization:
    - case_status is Active (case-insensitive)
    - reintegration_status is not Completed (still in reintegration pathway)
    """
    cs = residents["case_status"].astype(str).str.strip().str.lower()
    rs = residents["reintegration_status"].astype(str).str.strip().str.lower()
    mask = (cs == "active") & (rs != "completed")
    return set(residents.loc[mask, "resident_id"].astype(int).tolist())


def _latest_snapshot_per_resident(df: pd.DataFrame) -> pd.DataFrame:
    """One row per resident: the snapshot with the latest observation_date (time-aware, no leakage)."""
    d = df.sort_values(["resident_id", "observation_date"])
    out = d.groupby("resident_id", as_index=False).last()
    dup = out["resident_id"].duplicated().any()
    assert not dup, "duplicate resident_id in latest snapshot frame"
    return out


def _short_factor_line(line: str, max_len: int = 72) -> str:
    """Dashboard-friendly short line (feature emphasis, not full legal wording)."""
    s = line.strip()
    for sep in (" and associated", " — ", "\n"):
        if sep in s:
            s = s.split(sep)[0].strip()
            break
    if len(s) > max_len:
        s = s[: max_len - 1].rstrip() + "…"
    return s


def _load_scoring_artifacts(serialized_dir: Path | None = None) -> dict[str, Any]:
    serialized_dir = serialized_dir or config.SERIALIZED_DIR
    meta_path = serialized_dir / "reintegration_readiness_metadata.json"
    if not meta_path.is_file():
        raise FileNotFoundError(f"Missing metadata: {meta_path}. Run export_artifacts / run_all first.")
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    pipe = joblib.load(serialized_dir / "reintegration_readiness_pipeline.joblib")
    coef = serialized_dir / "explanation_logistic_coefficients.csv"
    if not coef.is_file():
        coef = config.OUTPUTS_DIR / "explanatory_logistic_coefficients.csv"
    medians_path = serialized_dir / "train_reference_medians.json"
    stds_path = serialized_dir / "train_reference_stds.json"
    medians: dict = {}
    stds: dict = {}
    if medians_path.is_file():
        with open(medians_path, encoding="utf-8") as f:
            medians = json.load(f)
    if stds_path.is_file():
        with open(stds_path, encoding="utf-8") as f:
            stds = json.load(f)
    return {
        "pipeline": pipe,
        "meta": meta,
        "coef_path": coef,
        "medians": medians,
        "stds": stds,
    }


def score_all_current_residents(
    top_k: int = 10,
    data_dir: Path | None = None,
    serialized_dir: Path | None = None,
    outputs_dir: Path | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    """
    Build latest snapshot per active resident, score with saved pipeline, rank by lowest score = highest priority.

    Adds cohort-relative fields: percentile, quartile-based ``support_priority_group``,
    ``operational_band``, and ``raw_score_note`` (see ``current_resident_scoring_metadata.json``).

    Returns:
        full_df: one row per active resident with scores, explanations, ranks, operational fields
        top_priority_df: top ``top_k`` rows by priority (lowest scores first)
        compression_diag: diagnostics dict from ``score_compression_diagnostics``
    """
    data_dir = data_dir or config.DEFAULT_DATA_DIR
    serialized_dir = serialized_dir or config.SERIALIZED_DIR
    outputs_dir = outputs_dir or config.OUTPUTS_DIR
    outputs_dir.mkdir(parents=True, exist_ok=True)

    art = _load_scoring_artifacts(serialized_dir)
    pipe = art["pipeline"]
    meta = art["meta"]
    num = list(meta["numeric_features"])
    cat = list(meta["categorical_features"])
    threshold = float(meta.get("selected_threshold", 0.5))
    Xcols = num + cat

    tables = parse_datetime_columns(load_tables(data_dir))
    residents = tables["residents"]
    active_ids = _active_resident_ids(residents)

    snap_df, _snap_meta = build_snapshot_frame(tables)
    latest = _latest_snapshot_per_resident(snap_df)
    latest = latest[latest["resident_id"].isin(active_ids)].copy()
    if latest.empty:
        raise RuntimeError("No active residents with at least one snapshot; check data and filters.")

    assert latest["resident_id"].nunique() == len(latest)

    latest = latest.reset_index(drop=True)
    proba = pipe.predict_proba(latest[Xcols])[:, 1]

    records: list[dict[str, Any]] = []

    for idx in range(len(latest)):
        row = latest.iloc[[idx]]
        p = float(proba[idx])
        code = str(row["internal_code"].iloc[0]) if "internal_code" in row.columns else str(row["resident_id"].iloc[0])
        rid = int(row["resident_id"].iloc[0])
        as_of = row["observation_date"].iloc[0]

        payload = build_inference_payload(
            p,
            threshold,
            pipe,
            row[Xcols],
            num,
            cat,
            config.TARGET_COL,
            coef_csv_path=art["coef_path"],
            reference_medians={k: float(v) for k, v in art["medians"].items() if k in num},
            reference_stds={k: float(v) for k, v in art["stds"].items() if k in num},
            train_df=None,
        )

        records.append(
            {
                "resident_id": rid,
                "resident_code": code,
                "as_of_date": pd.Timestamp(as_of).isoformat() if pd.notna(as_of) else "",
                "reintegration_readiness_score": payload["reintegration_readiness_score"],
                "decision_threshold": payload["decision_threshold"],
                "readiness_band": payload["readiness_band"],
                "predicted_positive_at_threshold": payload["predicted_positive_at_threshold"],
                "top_positive_factors": payload["top_positive_factors"],
                "top_risk_factors": payload["top_risk_factors"],
                "note": payload.get("note", ""),
            }
        )

    full_df = pd.DataFrame(records)
    full_df["_sort_score"] = full_df["reintegration_readiness_score"].astype(float)
    full_df = full_df.sort_values(["_sort_score", "resident_id"], ascending=[True, True]).reset_index(drop=True)
    n_cohort = len(full_df)
    full_df["support_priority_rank"] = range(1, n_cohort + 1)

    scores = full_df["reintegration_readiness_score"].astype(float)
    compression_diag = score_compression_diagnostics(scores.values)
    pct_series = cohort_readiness_percentile(scores)
    full_df["readiness_percentile_among_current_residents"] = pct_series.values

    full_df["support_priority_group"] = full_df["support_priority_rank"].apply(
        lambda r: support_priority_group_from_rank(int(r), n_cohort)
    )
    full_df["operational_band"] = full_df["support_priority_group"].map(operational_band_for_group)
    note_compression = raw_score_note(compression_diag)
    full_df["raw_score_note"] = note_compression
    full_df["interpretation_note"] = INTERPRETATION_NOTE_SHORT

    full_df = full_df.drop(columns=["_sort_score"])

    _col_order = [
        "support_priority_rank",
        "support_priority_group",
        "operational_band",
        "resident_id",
        "resident_code",
        "as_of_date",
        "reintegration_readiness_score",
        "readiness_percentile_among_current_residents",
        "decision_threshold",
        "readiness_band",
        "predicted_positive_at_threshold",
        "raw_score_note",
        "interpretation_note",
        "top_positive_factors",
        "top_risk_factors",
        "note",
    ]
    full_df = full_df[[c for c in _col_order if c in full_df.columns]]

    top_priority_df = full_df.head(top_k).copy()

    # --- exports ---
    def _json_safe(obj: Any) -> Any:
        if isinstance(obj, dict):
            return {k: _json_safe(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_json_safe(v) for v in obj]
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, bool):
            return obj
        return obj

    scoring_meta = {
        "interpretation_note": INTERPRETATION_NOTE_SHORT,
        "operational_rules": {
            "priority_rank_definition": "1 = lowest raw readiness score among current active residents (highest intervention priority).",
            "readiness_percentile_definition": "Higher percentile = higher raw score within this cohort (better relative readiness).",
            "support_priority_group_rule": "Quartiles by rank/n: ≤25% Top Priority, ≤50% High Priority, ≤75% Moderate Priority, else Lower Priority.",
            "operational_band_maps_to_group": {
                "Top Priority": "Needs Immediate Review",
                "High Priority": "Needs Close Follow-up",
                "Moderate Priority": "Routine Monitoring",
                "Lower Priority": "Lower Urgency",
            },
            "raw_probability_band_note": "readiness_band uses fixed score cutoffs from config.READINESS_BANDS; often all active residents fall in the lowest band when probabilities are compressed.",
            "tie_handling": "Identical raw scores are ordered by resident_id for support_priority_rank; quartile groups use rank/n, so tied scores can land in different priority groups.",
        },
        "score_compression_diagnostics": compression_diag,
        "trained_model_horizon_days": config.SUCCESS_HORIZON_DAYS,
        "alternate_horizons_todo_days": list(config.SUCCESS_HORIZON_DAYS_ALTERNATIVES),
    }
    with open(outputs_dir / "current_resident_scoring_metadata.json", "w", encoding="utf-8") as f:
        json.dump(_json_safe(scoring_meta), f, indent=2, default=str)

    full_records = full_df.to_dict(orient="records")
    with open(outputs_dir / "current_resident_scores.json", "w", encoding="utf-8") as f:
        json.dump(_json_safe(full_records), f, indent=2, default=str)

    # CSV: lists as JSON strings for readability in Excel
    csv_df = full_df.copy()
    for col in ("top_positive_factors", "top_risk_factors"):
        csv_df[col] = csv_df[col].apply(json.dumps)
    csv_df.to_csv(outputs_dir / "current_resident_scores.csv", index=False)

    top_records = top_priority_df.to_dict(orient="records")
    with open(outputs_dir / f"top_{top_k}_priority_residents.json", "w", encoding="utf-8") as f:
        json.dump(_json_safe(top_records), f, indent=2, default=str)
    top_csv = top_priority_df.copy()
    for col in ("top_positive_factors", "top_risk_factors"):
        top_csv[col] = top_csv[col].apply(json.dumps)
    top_csv.to_csv(outputs_dir / f"top_{top_k}_priority_residents.csv", index=False)

    dashboard: list[dict[str, Any]] = []
    for _, r in full_df.iterrows():
        pos_s = [_short_factor_line(x) for x in (r["top_positive_factors"] or [])[:4]]
        risk_s = [_short_factor_line(x) for x in (r["top_risk_factors"] or [])[:4]]
        dashboard.append(
            {
                "resident_code": r["resident_code"],
                "as_of_date": r["as_of_date"],
                "reintegration_readiness_score": r["reintegration_readiness_score"],
                "readiness_percentile_among_current_residents": round(
                    float(r["readiness_percentile_among_current_residents"]), 2
                ),
                "support_priority_rank": int(r["support_priority_rank"]),
                "support_priority_group": r["support_priority_group"],
                "operational_band": r["operational_band"],
                "readiness_band_raw_probability": r["readiness_band"],
                "top_positive_factors_short": pos_s,
                "top_risk_factors_short": risk_s,
                "raw_score_note": r["raw_score_note"],
            }
        )
    with open(outputs_dir / "current_resident_scores_dashboard.json", "w", encoding="utf-8") as f:
        json.dump(_json_safe(dashboard), f, indent=2, default=str)

    return full_df, top_priority_df, compression_diag


def _print_summary(
    full_df: pd.DataFrame,
    top_df: pd.DataFrame,
    outputs_dir: Path,
    top_k: int,
    compression_diag: dict[str, Any] | None = None,
) -> None:
    scores = full_df["reintegration_readiness_score"].astype(float)
    diag = compression_diag if compression_diag is not None else score_compression_diagnostics(scores.values)

    print("=== Current resident scoring summary ===")
    print(f"Residents scored (active, latest snapshot each): {len(full_df)}")
    print(f"Priority rule: rank 1 = lowest raw readiness score (highest support priority).")
    print(f"Operational bands use quartiles of rank within this cohort (see current_resident_scoring_metadata.json).")
    print()
    print("--- Raw score distribution (cohort) ---")
    print(f"  min: {diag['score_min']:.6f}  median: {diag['score_median']:.6f}  max: {diag['score_max']:.6f}  range: {diag['score_range']:.6f}")
    print(f"  unique scores (6 dp): {diag['unique_scores_rounded_6']}  |  pct below 0.05: {diag['pct_scores_below_0_05']:.1f}%")
    print(f"  quantiles [0,25,50,75,100]: {[round(x, 6) for x in diag['quantiles_0_25_50_75_100']]}")
    if diag.get("score_compression_flag"):
        print(f"  [compression] {diag.get('compression_note', '')}")
    else:
        print(f"  Compression flag: false — {diag.get('compression_note', '')}")
    print()
    print(f"--- Top {len(top_df)} priority residents (use rank / percentile / operational band for triage) ---")
    display_cols = [
        "support_priority_rank",
        "resident_code",
        "reintegration_readiness_score",
        "readiness_percentile_among_current_residents",
        "support_priority_group",
        "operational_band",
    ]
    print(top_df[display_cols].to_string(index=False))
    print()
    print("--- Lowest 5 readiness scores ---")
    low5 = full_df.nsmallest(5, "reintegration_readiness_score")[
        ["resident_code", "reintegration_readiness_score", "readiness_percentile_among_current_residents", "operational_band"]
    ]
    print(low5.to_string(index=False))
    print()
    print("--- Highest 5 readiness scores ---")
    hi5 = full_df.nlargest(5, "reintegration_readiness_score")[
        ["resident_code", "reintegration_readiness_score", "readiness_percentile_among_current_residents", "operational_band"]
    ]
    print(hi5.to_string(index=False))
    print()
    print("Output files:")
    for name in (
        "current_resident_scoring_metadata.json",
        "current_resident_scores.csv",
        "current_resident_scores.json",
        f"top_{top_k}_priority_residents.csv",
        f"top_{top_k}_priority_residents.json",
        "current_resident_scores_dashboard.json",
    ):
        print(f"  {outputs_dir / name}")


def main() -> None:
    top_k = 10
    if len(sys.argv) > 1:
        try:
            top_k = int(sys.argv[1])
        except ValueError:
            pass

    full_df, top_df, diag = score_all_current_residents(top_k=top_k)
    _print_summary(full_df, top_df, config.OUTPUTS_DIR, top_k, compression_diag=diag)


if __name__ == "__main__":
    main()
