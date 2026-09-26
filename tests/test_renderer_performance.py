"""Verify the JS monitor against the Renderer in the active Python environment."""

from pathlib import Path
import shutil
import subprocess

import dash
import pytest


def test_installed_renderer_performance_contract():
    node = shutil.which("node")
    if not node:
        pytest.skip("Node.js is required for the Renderer integration test")
    renderer = (
        Path(dash.__file__).parent / "dash-renderer" / "build" / "dash_renderer.dev.js"
    )
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        [node, "frontend/tests/rendererPerformance.integration.js", str(renderer)],
        cwd=root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
