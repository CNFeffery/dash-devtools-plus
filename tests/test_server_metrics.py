from dash_devtools_plus.server_metrics import collect_server_metrics


def test_server_metrics_snapshot_is_json_ready_and_complete():
    snapshot = collect_server_metrics()

    assert snapshot["timestamp"] > 0
    assert 0 <= snapshot["cpu"]["percent"] <= 100
    assert snapshot["cpu"]["logicalCores"] >= 1
    assert 0 <= snapshot["memory"]["percent"] <= 100
    assert snapshot["memory"]["totalBytes"] > 0
    assert 0 <= snapshot["disk"]["percent"] <= 100
    assert snapshot["disk"]["totalBytes"] > 0
    assert "network" not in snapshot
    assert "process" not in snapshot
    assert snapshot["system"]["hostname"]
    assert snapshot["system"]["pythonVersion"]


def test_server_metrics_does_not_expose_filesystem_paths():
    snapshot = collect_server_metrics()

    assert "path" not in snapshot["disk"]
    assert "cwd" not in snapshot["system"]
