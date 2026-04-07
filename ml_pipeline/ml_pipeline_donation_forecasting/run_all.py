#!/usr/bin/env python3
"""Train + export donation forecasting artifacts. Run from ``ml_pipeline``::

    python3 -m ml_pipeline_donation_forecasting.run_all
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ML = Path(__file__).resolve().parent.parent
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from ml_pipeline_donation_forecasting import config
from ml_pipeline_donation_forecasting.data_prep import load_donation_tables, parse_dates
from ml_pipeline_donation_forecasting.export_artifacts import export_all
from ml_pipeline_donation_forecasting.feature_engineering import build_supervised_rows


def main() -> None:
    tabs = parse_dates(load_donation_tables(config.DEFAULT_DATA_DIR))
    df, meta = build_supervised_rows(tabs["donations"], tabs["donation_allocations"], tabs["supporters"])
    info = export_all(df, meta)
    print(json.dumps({"rows": len(df), "holdout_amount": info["holdout_amount_metrics"]}, indent=2))


if __name__ == "__main__":
    main()
