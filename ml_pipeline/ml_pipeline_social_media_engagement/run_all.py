#!/usr/bin/env python3
"""Train + export social media engagement artifacts. Run from ``ml_pipeline``::

    python3 -m ml_pipeline_social_media_engagement.run_all
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ML = Path(__file__).resolve().parent.parent
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from ml_pipeline_social_media_engagement.export_artifacts import export_all


def main() -> None:
    info = export_all()
    print(json.dumps(info, indent=2, default=str))


if __name__ == "__main__":
    main()
