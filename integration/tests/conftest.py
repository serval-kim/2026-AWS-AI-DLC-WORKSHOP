"""Shared test fixtures and path configuration."""

import sys
from pathlib import Path

# Add integration and serval to path for imports
_INTEGRATION_DIR = Path(__file__).resolve().parent.parent
_BASE_DIR = _INTEGRATION_DIR.parent
_SERVAL_PATH = str(_BASE_DIR / "ad-hoc" / "serval")

if str(_INTEGRATION_DIR) not in sys.path:
    sys.path.insert(0, str(_INTEGRATION_DIR))
if _SERVAL_PATH not in sys.path:
    sys.path.insert(0, _SERVAL_PATH)
