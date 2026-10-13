from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXAMPLES = ROOT / "examples"
WORKFLOWS = ROOT / "workflows"
RUNS = ROOT / "runs"
MAX_JOBS = 20

PREVIEW_PAGES = 10
PREVIEW_ITEMS = 25
PREVIEW_TIMEOUT = 120
RUN_TIMEOUT = 600
LOG_TAIL = 8000
