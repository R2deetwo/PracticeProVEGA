"""Pytest wrapper around the offline selftest so `pytest tools/legal_ingester`
works in CI-style runs. The same checks are available standalone via
`python -m legal_ingester selftest`."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_selftest_passes() -> None:
    pkg_dir = Path(__file__).resolve().parent.parent
    result = subprocess.run(
        [sys.executable, "-m", "legal_ingester", "selftest"],
        cwd=pkg_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, f"selftest failed:\n{result.stdout}\n{result.stderr}"
    assert "ALL CHECKS PASSED" in result.stdout
