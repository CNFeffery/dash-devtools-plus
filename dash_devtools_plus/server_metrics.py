"""Lightweight server metrics used by the debug-only resource panel."""

from __future__ import annotations

import os
import platform
import socket
import time
from pathlib import Path
from threading import Lock
from typing import Any, Callable

import psutil


_SAMPLE_LOCK = Lock()

# Prime psutil's non-blocking CPU counters. Later calls report usage since the
# previous sample instead of blocking the Dash request for an interval.
psutil.cpu_percent(interval=None)


def _safe_value(factory: Callable[[], Any], default: Any = None) -> Any:
    try:
        return factory()
    except (AttributeError, OSError, PermissionError, psutil.Error):
        return default


def _disk_root() -> str:
    anchor = Path.cwd().resolve().anchor
    return anchor or os.path.abspath(os.sep)


def _frequency() -> float | None:
    frequency = _safe_value(psutil.cpu_freq)
    return round(float(frequency.current), 1) if frequency else None


def collect_server_metrics() -> dict[str, Any]:
    """Collect a JSON-serialisable snapshot without blocking the server."""

    with _SAMPLE_LOCK:
        now = time.time()
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage(_disk_root())
        boot_time = float(_safe_value(psutil.boot_time, now))

        return {
            "timestamp": round(now * 1000),
            "system": {
                "hostname": socket.gethostname(),
                "operatingSystem": platform.system(),
                "osRelease": platform.release(),
                "architecture": platform.machine(),
                "processor": platform.processor() or platform.machine(),
                "pythonVersion": platform.python_version(),
                "bootTime": round(boot_time * 1000),
                "uptimeSeconds": max(0, round(now - boot_time)),
            },
            "cpu": {
                "percent": round(float(psutil.cpu_percent(interval=None)), 1),
                "physicalCores": psutil.cpu_count(logical=False),
                "logicalCores": psutil.cpu_count(logical=True),
                "frequencyMhz": _frequency(),
            },
            "memory": {
                "percent": round(float(memory.percent), 1),
                "usedBytes": int(memory.used),
                "totalBytes": int(memory.total),
                "availableBytes": int(memory.available),
            },
            "disk": {
                "percent": round(float(disk.percent), 1),
                "usedBytes": int(disk.used),
                "totalBytes": int(disk.total),
                "freeBytes": int(disk.free),
            },
        }
