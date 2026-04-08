#!/usr/bin/env python3
"""
Refresh ML artifacts under ``backend/Intex.API/App_Data/ml/``.

Run from the repository root (WinterIntex4-5)::

    python3 refresh_ml_artifacts.py

Equivalent (from ``ml-pipelines``)::

    cd ml-pipelines && PYTHONPATH=. python3 -m ml_backend_export.run_all_backend_exports

Or from repo root::

    PYTHONPATH=ml-pipelines python3 -m ml_backend_export.run_all_backend_exports
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(_ROOT / "ml-pipelines"))

from ml_backend_export.run_all_backend_exports import main

if __name__ == "__main__":
    raise SystemExit(main())
