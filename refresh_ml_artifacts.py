#!/usr/bin/env python3
"""
**Canonical entrypoint** for refreshing ML artifacts under ``backend/Intex.API/App_Data/ml/``.

Use this script for local runs and for CI (e.g. ``.github/workflows/nightly-ml-refresh.yml``).
It delegates to ``ml_backend_export.run_all_backend_exports`` and exits with a **non-zero**
status if required outputs are missing or empty after a run.

**Duplicate removed:** ``refresh_ml_artifacts 2.py`` was an identical copy and has been deleted.

Run from the **repository root** (the folder that contains ``ml-pipelines/`` and ``refresh_ml_artifacts.py``)::

    python3 refresh_ml_artifacts.py

Equivalent (from ``ml-pipelines``)::

    cd ml-pipelines && PYTHONPATH=. python3 -m ml_backend_export.run_all_backend_exports

Or from repo root without this file::

    PYTHONPATH=ml-pipelines python3 -m ml_backend_export.run_all_backend_exports
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
ML_PIPELINES_DIR = REPO_ROOT / "ml-pipelines"
if str(ML_PIPELINES_DIR) not in sys.path:
    sys.path.insert(0, str(ML_PIPELINES_DIR))

from ml_backend_export.run_all_backend_exports import main

if __name__ == "__main__":
    raise SystemExit(main())
