#!/usr/bin/env python3
"""
One-off / maint: normalize ml-pipelines notebooks (paths, clear outputs, nbformat validate).
Run from repo root: python3 scripts/patch_ml_notebooks.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import nbformat
from nbformat.validator import normalize, validate

REPO_ROOT = Path(__file__).resolve().parent.parent
ML_PIPELINES = REPO_ROOT / "ml-pipelines"


def _clear_outputs(nb: nbformat.NotebookNode) -> None:
    for cell in nb.cells:
        if cell.cell_type == "code":
            cell.outputs = []
            cell.execution_count = None


def _save(nb: nbformat.NotebookNode, path: Path) -> None:
    _clear_outputs(nb)
    _, nbdict = normalize(nb)
    nb2 = nbformat.from_dict(nbdict)
    validate(nb2)
    nbformat.write(nb2, path)


_PIPELINE_PATH_BLOCK = re.compile(
    r"# 1\. Setup Data Paths \(Robust logic from project standards\)\n"
    r"NOTEBOOK_DIR = Path\.cwd\(\)\.resolve\(\)\n"
    r"if NOTEBOOK_DIR\.name\.startswith\(\"pipeline_\"\):\n"
    r"    REPO_ROOT = NOTEBOOK_DIR\.parent\.parent\n"
    r"elif NOTEBOOK_DIR\.name == \"ml-pipelines\":\n"
    r"    REPO_ROOT = NOTEBOOK_DIR\.parent\n"
    r"elif \(NOTEBOOK_DIR / \"ml-pipelines\"\)\.is_dir\(\):\n"
    r"    REPO_ROOT = NOTEBOOK_DIR\n"
    r"else:\n"
    r"    REPO_ROOT = NOTEBOOK_DIR\n\n"
    r"DATA_DIR = REPO_ROOT / \"data\" / \"lighthouse_csv_v7\"\n"
    r"if not DATA_DIR\.exists\(\):\n"
    r"(?:    # Final fallback attempt for different runners\n)?"
    r"    DATA_DIR = Path\(\"\.\./\.\./data/lighthouse_csv_v7\"\)\n\n",
    re.MULTILINE,
)

_PIPELINE_PATH_NEW = """# Repo paths: walk up until ml-pipelines/ and data/lighthouse_csv_v7/ exist
def _find_repo_root(start: Path) -> Path:
    p = start.resolve()
    for d in [p, *p.parents]:
        if (d / "ml-pipelines").is_dir() and (d / "data" / "lighthouse_csv_v7").is_dir():
            return d
    raise FileNotFoundError(
        "Could not find repo root (need ml-pipelines/ and data/lighthouse_csv_v7/). "
        f"cwd={p}"
    )

REPO_ROOT = _find_repo_root(Path.cwd())
DATA_DIR = REPO_ROOT / "data" / "lighthouse_csv_v7"
if not DATA_DIR.is_dir():
    raise FileNotFoundError(f"Missing data directory: {DATA_DIR}")

"""

_DONOR_OLD = '''# Resolve repo root + paths (cwd may be repo root, ml-pipelines/, or donor_retention/)
NOTEBOOK_DIR = Path.cwd().resolve()
if NOTEBOOK_DIR.name == "donor_retention":
    REPO_ROOT = NOTEBOOK_DIR.parent.parent
elif NOTEBOOK_DIR.name in ("ml_pipeline", "ml-pipelines"):
    REPO_ROOT = NOTEBOOK_DIR.parent
elif (NOTEBOOK_DIR / "ml-pipelines").is_dir():
    REPO_ROOT = NOTEBOOK_DIR
else:
    REPO_ROOT = NOTEBOOK_DIR

DATA_DIR = REPO_ROOT / "data" / "lighthouse_csv_v7"
if not DATA_DIR.is_dir():
    raise FileNotFoundError(f"Missing {DATA_DIR} — open Jupyter from repo root or subfolder of this project.")

SERIALIZED_DIR = REPO_ROOT / "ml-pipelines" / "donor_retention" / "serialized_models"
SERIALIZED_DIR.mkdir(parents=True, exist_ok=True)

print("DATA_DIR:", DATA_DIR)
print("SERIALIZED_DIR:", SERIALIZED_DIR)'''

_DONOR_NEW = '''# Repo paths (cwd may be repo root, ml-pipelines/, or donor_retention/)
def _find_repo_root(start: Path) -> Path:
    p = start.resolve()
    for d in [p, *p.parents]:
        if (d / "ml-pipelines").is_dir() and (d / "data" / "lighthouse_csv_v7").is_dir():
            return d
    raise FileNotFoundError(
        "Could not find repo root (need ml-pipelines/ and data/lighthouse_csv_v7/). "
        f"cwd={p}"
    )

REPO_ROOT = _find_repo_root(Path.cwd())
ML_PIPELINES_DIR = REPO_ROOT / "ml-pipelines"
DATA_DIR = REPO_ROOT / "data" / "lighthouse_csv_v7"
if not DATA_DIR.is_dir():
    raise FileNotFoundError(f"Missing data directory: {DATA_DIR}")

SERIALIZED_DIR = ML_PIPELINES_DIR / "donor_retention" / "serialized_models"
SERIALIZED_DIR.mkdir(parents=True, exist_ok=True)

print("REPO_ROOT:", REPO_ROOT)
print("DATA_DIR:", DATA_DIR)
print("SERIALIZED_DIR:", SERIALIZED_DIR)'''

_RESIDENT_OLD = r'''NOTEBOOK_DIR = Path.cwd().resolve()
if NOTEBOOK_DIR.name == "resident_case_progress":
    REPO_ROOT = NOTEBOOK_DIR.parent.parent
elif NOTEBOOK_DIR.name in ("ml_pipeline", "ml-pipelines"):
    REPO_ROOT = NOTEBOOK_DIR.parent
elif (NOTEBOOK_DIR / "ml-pipelines").is_dir():
    REPO_ROOT = NOTEBOOK_DIR
else:
    REPO_ROOT = NOTEBOOK_DIR

DATA_DIR = REPO_ROOT / "data" / "lighthouse_csv_v7"
if not DATA_DIR.is_dir():
    raise FileNotFoundError(f"Missing {DATA_DIR}")

SERIALIZED_DIR = REPO_ROOT / "ml-pipelines" / "resident_case_progress" / "serialized_models"
SERIALIZED_DIR.mkdir(parents=True, exist_ok=True)

print("DATA_DIR:", DATA_DIR)
print("SERIALIZED_DIR:", SERIALIZED_DIR)'''

_RESIDENT_NEW = '''def _find_repo_root(start: Path) -> Path:
    p = start.resolve()
    for d in [p, *p.parents]:
        if (d / "ml-pipelines").is_dir() and (d / "data" / "lighthouse_csv_v7").is_dir():
            return d
    raise FileNotFoundError(
        "Could not find repo root (need ml-pipelines/ and data/lighthouse_csv_v7/). "
        f"cwd={p}"
    )

REPO_ROOT = _find_repo_root(Path.cwd())
ML_PIPELINES_DIR = REPO_ROOT / "ml-pipelines"
DATA_DIR = REPO_ROOT / "data" / "lighthouse_csv_v7"
if not DATA_DIR.is_dir():
    raise FileNotFoundError(f"Missing data directory: {DATA_DIR}")

SERIALIZED_DIR = ML_PIPELINES_DIR / "resident_case_progress" / "serialized_models"
SERIALIZED_DIR.mkdir(parents=True, exist_ok=True)

print("REPO_ROOT:", REPO_ROOT)
print("DATA_DIR:", DATA_DIR)
print("SERIALIZED_DIR:", SERIALIZED_DIR)'''

_READINESS_OLD = r'''NOTEBOOK_DIR = Path.cwd().resolve()
if NOTEBOOK_DIR.name in ("ml_pipeline", "ml-pipelines"):
    ML_PIPELINE = NOTEBOOK_DIR
elif NOTEBOOK_DIR.name == "ml_pipeline_reintegration_readiness_scorer":
    ML_PIPELINE = NOTEBOOK_DIR.parent
else:
    ML_PIPELINE = NOTEBOOK_DIR / "WinterIntex4-5" / "ml-pipelines"

if str(ML_PIPELINE) not in sys.path:
    sys.path.insert(0, str(ML_PIPELINE))

DATA_DIR = ML_PIPELINE.parent / "data" / "lighthouse_csv_v7"
print("ML_PIPELINE:", ML_PIPELINE)
print("DATA_DIR:", DATA_DIR)'''

_READINESS_NEW = '''def _find_repo_root(start: Path) -> Path:
    p = start.resolve()
    for d in [p, *p.parents]:
        if (d / "ml-pipelines").is_dir() and (d / "data" / "lighthouse_csv_v7").is_dir():
            return d
    raise FileNotFoundError(
        "Could not find repo root (need ml-pipelines/ and data/lighthouse_csv_v7/). "
        f"cwd={p}"
    )

REPO_ROOT = _find_repo_root(Path.cwd())
ML_PIPELINES_DIR = REPO_ROOT / "ml-pipelines"
ML_PIPELINE = ML_PIPELINES_DIR
DATA_DIR = REPO_ROOT / "data" / "lighthouse_csv_v7"
if str(ML_PIPELINES_DIR) not in sys.path:
    sys.path.insert(0, str(ML_PIPELINES_DIR))

print("ML_PIPELINE:", ML_PIPELINE)
print("DATA_DIR:", DATA_DIR)'''

_SOCIAL_OLD = r'''NOTEBOOK_DIR = Path.cwd().resolve()
if NOTEBOOK_DIR.name == "ml_pipeline_social_media_engagement":
    ML_PIPELINE = NOTEBOOK_DIR.parent
elif NOTEBOOK_DIR.name in ("ml_pipeline", "ml-pipelines"):
    ML_PIPELINE = NOTEBOOK_DIR
else:
    ML_PIPELINE = NOTEBOOK_DIR / "WinterIntex4-5" / "ml-pipelines"
    if not ML_PIPELINE.is_dir():
        ML_PIPELINE = NOTEBOOK_DIR / "ml-pipelines"

if str(ML_PIPELINE) not in sys.path:
    sys.path.insert(0, str(ML_PIPELINE))'''

_SOCIAL_NEW = '''def _find_repo_root(start: Path) -> Path:
    p = start.resolve()
    for d in [p, *p.parents]:
        if (d / "ml-pipelines").is_dir() and (d / "data" / "lighthouse_csv_v7").is_dir():
            return d
    raise FileNotFoundError(
        "Could not find repo root (need ml-pipelines/ and data/lighthouse_csv_v7/). "
        f"cwd={p}"
    )

REPO_ROOT = _find_repo_root(Path.cwd())
ML_PIPELINES_DIR = REPO_ROOT / "ml-pipelines"
ML_PIPELINE = ML_PIPELINES_DIR
if str(ML_PIPELINES_DIR) not in sys.path:
    sys.path.insert(0, str(ML_PIPELINES_DIR))'''

_DONATION_OLD = r'''HERE = Path.cwd().resolve()
for p in (HERE, HERE / "ml-pipelines", HERE.parent / "ml-pipelines", HERE.parent):
    if (p / "ml_pipeline_donation_forecasting" / "config.py").is_file():
        sys.path.insert(0, str(p))
        break
else:
    raise RuntimeError("Run from ml-pipelines/ or repo root")'''

_DONATION_NEW = '''def _find_repo_root(start: Path) -> Path:
    p = start.resolve()
    for d in [p, *p.parents]:
        if (d / "ml-pipelines").is_dir() and (d / "data" / "lighthouse_csv_v7").is_dir():
            return d
    raise FileNotFoundError(
        "Could not find repo root (need ml-pipelines/ and data/lighthouse_csv_v7/). "
        f"cwd={p}"
    )

REPO_ROOT = _find_repo_root(Path.cwd())
ML_PIPELINES_DIR = REPO_ROOT / "ml-pipelines"
if str(ML_PIPELINES_DIR) not in sys.path:
    sys.path.insert(0, str(ML_PIPELINES_DIR))'''

_EFFECTIVENESS_OLD = r'''# Resolve package: cwd may be repo root, ml-pipelines/, or this package folder
HERE = Path.cwd().resolve()
_candidates = [
    HERE,
    HERE / "ml-pipelines",
    HERE.parent / "ml-pipelines",
    HERE.parent,
]
for p in _candidates:
    if (p / "ml_pipeline_reintegration_effectiveness" / "config.py").is_file():
        sys.path.insert(0, str(p))
        break
else:
    raise RuntimeError(
        "Add WinterIntex4-5/ml-pipelines to path or run Jupyter with cwd under ml-pipelines/"
    )'''

_EFFECTIVENESS_NEW = '''def _find_repo_root(start: Path) -> Path:
    p = start.resolve()
    for d in [p, *p.parents]:
        if (d / "ml-pipelines").is_dir() and (d / "data" / "lighthouse_csv_v7").is_dir():
            return d
    raise FileNotFoundError(
        "Could not find repo root (need ml-pipelines/ and data/lighthouse_csv_v7/). "
        f"cwd={p}"
    )

REPO_ROOT = _find_repo_root(Path.cwd())
ML_PIPELINES_DIR = REPO_ROOT / "ml-pipelines"
if str(ML_PIPELINES_DIR) not in sys.path:
    sys.path.insert(0, str(ML_PIPELINES_DIR))'''


def _patch_cell_source(src: str, old: str, new: str, label: str) -> str:
    if old not in src:
        raise SystemExit(f"Expected block not found ({label}); aborting.")
    return src.replace(old, new, 1)


def _already_repo_relative(cell_src: str) -> bool:
    return "_find_repo_root" in cell_src


def main() -> int:
    if not ML_PIPELINES.is_dir():
        print("Run from repository root.", file=sys.stderr)
        return 1

    patches: list[tuple[Path, int, str, str, str]] = [
        (
            ML_PIPELINES / "donor_retention" / "donor_retention_churn.ipynb",
            3,
            _DONOR_OLD,
            _DONOR_NEW,
            "donor_retention",
        ),
        (
            ML_PIPELINES / "resident_case_progress" / "resident_elevated_risk.ipynb",
            4,
            _RESIDENT_OLD,
            _RESIDENT_NEW,
            "resident",
        ),
        (
            ML_PIPELINES / "ml_pipeline_reintegration_readiness_scorer" / "reintegration_readiness.ipynb",
            1,
            _READINESS_OLD,
            _READINESS_NEW,
            "readiness",
        ),
        (
            ML_PIPELINES / "ml_pipeline_social_media_engagement" / "social_media_engagement.ipynb",
            1,
            _SOCIAL_OLD,
            _SOCIAL_NEW,
            "social",
        ),
        (
            ML_PIPELINES / "ml_pipeline_donation_forecasting" / "donation_forecasting.ipynb",
            2,
            _DONATION_OLD,
            _DONATION_NEW,
            "donation",
        ),
        (
            ML_PIPELINES / "ml_pipeline_reintegration_effectiveness" / "reintegration_effectiveness.ipynb",
            2,
            _EFFECTIVENESS_OLD,
            _EFFECTIVENESS_NEW,
            "effectiveness",
        ),
    ]

    for path, idx, old, new, label in patches:
        nb = nbformat.read(path, as_version=4)
        cell = nb.cells[idx]
        if cell.cell_type != "code":
            print(f"Wrong cell type at {path} [{idx}]", file=sys.stderr)
            return 1
        if _already_repo_relative(cell.source):
            _save(nb, path)
            print("Already patched (re-normalized)", path)
            continue
        cell.source = _patch_cell_source(cell.source, old, new, f"{path}:{label}")
        _save(nb, path)
        print("Patched", path)

    pipeline_notebooks = [
        ML_PIPELINES / "pipeline_a_incident_escalation" / "incident_escalation_risk.ipynb",
        ML_PIPELINES / "pipeline_b_health_trajectory" / "health_trajectory_model.ipynb",
        ML_PIPELINES / "pipeline_c_donor_upgrade" / "donor_upgrade_scorer.ipynb",
        ML_PIPELINES / "pipeline_d_campaign_roi" / "campaign_roi_attribution.ipynb",
    ]
    for path in pipeline_notebooks:
        nb = nbformat.read(path, as_version=4)
        cell = nb.cells[1]
        if cell.cell_type != "code":
            print(f"Wrong cell type at {path} [1]", file=sys.stderr)
            return 1
        if _already_repo_relative(cell.source):
            _save(nb, path)
            print("Already patched (re-normalized)", path)
            continue
        new_src, n = _PIPELINE_PATH_BLOCK.subn(_PIPELINE_PATH_NEW, cell.source, count=1)
        if n != 1:
            print(f"Pipeline path block not matched: {path}", file=sys.stderr)
            return 1
        cell.source = new_src
        _save(nb, path)
        print("Patched", path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
