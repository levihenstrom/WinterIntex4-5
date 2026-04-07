#!/usr/bin/env python3
"""Build snapshot dataset, train, export. From ``ml_pipeline``::

    python3 -m ml_pipeline_reintegration_readiness_scorer.run_all
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ML = Path(__file__).resolve().parent.parent
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from ml_pipeline_reintegration_readiness_scorer.export_artifacts import export_all


def main() -> None:
    info = export_all()
    print(json.dumps(info, indent=2, default=str))

    print("\n--- Pipeline summary ---")
    print(f"Best model: {info.get('best_model')}")
    print(f"Selected decision threshold (OOF-tuned): {info.get('selected_threshold')}")
    m0 = info.get("metrics_at_0.5") or {}
    mt = info.get("metrics_at_tuned") or {}
    print(
        "Holdout @ threshold 0.5 — ROC-AUC: {roc:.4f} PR-AUC: {pr:.4f} "
        "precision: {p:.4f} recall: {r:.4f} F1: {f1:.4f} Brier: {b}".format(
            roc=m0.get("roc_auc"),
            pr=m0.get("pr_auc"),
            p=m0.get("precision"),
            r=m0.get("recall"),
            f1=m0.get("f1"),
            b=m0.get("brier_score"),
        )
    )
    print(
        "Holdout @ tuned threshold — ROC-AUC: {roc:.4f} PR-AUC: {pr:.4f} "
        "precision: {p:.4f} recall: {r:.4f} F1: {f1:.4f} Brier: {b}".format(
            roc=mt.get("roc_auc"),
            pr=mt.get("pr_auc"),
            p=mt.get("precision"),
            r=mt.get("recall"),
            f1=mt.get("f1"),
            b=mt.get("brier_score"),
        )
    )
    print(f"Calibration wrapper used: {info.get('calibration_used')}")
    print(f"Brier (holdout, tuned row): {info.get('brier_holdout')}")
    tops = info.get("top_features") or []
    if tops:
        print("Top global features (transformed space):")
        for row in tops[:6]:
            print(f"  {row.get('feature')}: {row.get('importance', 0):.5f}")
    samp = info.get("sample_inference")
    if samp:
        print("\nSample inference payload:")
        print(json.dumps(samp, indent=2, default=str))


if __name__ == "__main__":
    main()
