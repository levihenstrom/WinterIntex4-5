"""Atomic file writes for safe repeated exports (nightly refresh)."""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any


def ensure_dir(path: Path | str) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def write_json_atomic(
    path: Path | str,
    obj: Any,
    *,
    indent: int = 2,
    sort_keys: bool = True,
) -> None:
    """Write JSON via a sibling temp file + ``os.replace`` to avoid truncated outputs."""
    path = Path(path)
    ensure_dir(path.parent)
    tmp = path.with_name(path.name + ".tmp")
    try:
        tmp.write_text(
            json.dumps(obj, indent=indent, default=str, allow_nan=False, sort_keys=sort_keys),
            encoding="utf-8",
        )
        os.replace(tmp, path)
    except BaseException:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass
        raise


def copy_file_atomic(src: Path | str, dst: Path | str) -> None:
    """Copy without leaving a truncated destination on failure mid-copy."""
    src, dst = Path(src), Path(dst)
    if not src.is_file():
        raise FileNotFoundError(src)
    ensure_dir(dst.parent)
    tmp = dst.with_name(dst.name + ".part")
    try:
        shutil.copy2(src, tmp)
        os.replace(tmp, dst)
    except BaseException:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass
        raise
