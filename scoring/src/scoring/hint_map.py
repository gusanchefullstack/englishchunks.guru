"""Maps recognizer/espeak phoneme symbols to the app's curated IPA hint symbols.

The table is the web app's `src/content/sound-hints.json` (single source of truth, copied into
the image at build time). Scores are reported per app symbol so the web app can attach the fixed,
curated hint for each sound (constitution II).
"""

import json
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import TypedDict, cast

_DEFAULT = Path(__file__).resolve().parents[3] / "web" / "src" / "content" / "sound-hints.json"
_STRESS = {"ˈ", "ˌ"}


def _strip(symbol: str) -> str:
    s = unicodedata.normalize("NFC", symbol)
    return "".join(ch for ch in s if ch not in _STRESS)


class Sound(TypedDict):
    ipa: str
    espeak: list[str]


class HintTable(TypedDict):
    version: int
    sounds: list[Sound]


class HintMap:
    def __init__(self, table: HintTable) -> None:
        self.version = table["version"]
        self._to_app: dict[str, str] = {}
        self.app_symbols: list[str] = []
        for sound in table["sounds"]:
            app = sound["ipa"]
            self.app_symbols.append(app)
            for sym in sound["espeak"]:
                self._to_app[_strip(sym)] = app

    def to_app(self, symbol: str) -> str | None:
        """App symbol for a recognizer symbol; tolerates a trailing length mark."""
        s = _strip(symbol)
        if s in self._to_app:
            return self._to_app[s]
        if s.endswith("ː") and s[:-1] in self._to_app:
            return self._to_app[s[:-1]]
        return None


@lru_cache
def load_hint_map(path: str | None = None) -> HintMap:
    p = Path(path) if path else _DEFAULT
    return HintMap(cast(HintTable, json.loads(p.read_text(encoding="utf-8"))))
