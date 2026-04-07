"""
Score one post feature row and generate next-post recommendations.

From ``ml_pipeline``::

    python3 -m ml_pipeline_social_media_engagement.inference_example
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from . import config
from .recommend_posts import save_recommendations_outputs


def main() -> None:
    meta_path = config.SERIALIZED_DIR / "social_media_engagement_metadata.json"
    if not meta_path.is_file():
        print("Run export_artifacts first.", file=sys.stderr)
        sys.exit(1)
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    num = meta["numeric_features"]
    cat = meta["categorical_features"]

    with open(config.SERIALIZED_DIR / "sample_payload_input.json", encoding="utf-8") as f:
        payload = json.load(f)
    row = pd.DataFrame([payload["features"]])
    for c in num + cat:
        if c not in row.columns:
            row[c] = np.nan

    X = row[num + cat]
    eng = joblib.load(config.SERIALIZED_DIR / "engagement_rate_pipeline.joblib")
    ref = joblib.load(config.SERIALIZED_DIR / "donation_referrals_count_pipeline.joblib")
    dval = joblib.load(config.SERIALIZED_DIR / "donation_value_log1p_pipeline.joblib")
    clf = joblib.load(config.SERIALIZED_DIR / "any_referral_classifier_pipeline.joblib")

    pe = float(eng.predict(X)[0])
    pr = float(ref.predict(X)[0])
    pv = float(np.expm1(dval.predict(X)[0]))
    p_any = float(clf.predict_proba(X)[0, 1])

    print(
        json.dumps(
            {
                "predicted_engagement_rate": round(pe, 4),
                "predicted_donation_referrals": round(pr, 2),
                "predicted_estimated_donation_value_php": round(pv, 2),
                "predicted_p_any_referral": round(p_any, 4),
            },
            indent=2,
        )
    )

    # Recommendation examples for post planning
    rec1, _, csv1, json1 = save_recommendations_outputs(
        goal="donations",
        top_k=3,
        output_stem="sample_recommendations_donations",
    )
    rec2, _, csv2, json2 = save_recommendations_outputs(
        goal="awareness",
        fixed_inputs={"platform": "Instagram", "day_of_week": "Thursday", "month": 7},
        top_k=3,
        output_stem="sample_recommendations_awareness_instagram",
    )
    rec3, _, csv3, json3 = save_recommendations_outputs(
        goal="mixed",
        fixed_inputs={"content_topic": "Reintegration"},
        top_k=3,
        output_stem="sample_recommendations_mixed_reintegration",
    )
    print(
        json.dumps(
            {
                "recommendation_samples": {
                    "donations": {"csv": str(csv1), "json": str(json1), "top1": rec1.iloc[0].to_dict()},
                    "awareness_fixed_platform": {
                        "csv": str(csv2),
                        "json": str(json2),
                        "top1": rec2.iloc[0].to_dict(),
                    },
                    "mixed_fixed_topic": {"csv": str(csv3), "json": str(json3), "top1": rec3.iloc[0].to_dict()},
                }
            },
            indent=2,
            default=str,
        )
    )


if __name__ == "__main__":
    main()
