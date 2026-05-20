"""입력 스키마 정의"""
from dataclasses import dataclass, field
from math import ceil


@dataclass
class Clip:
    start: str
    end: str
    effect: str
    desc: str


@dataclass
class Scene:
    text: str
    duration_sec: int
    emphasis: list[str] = field(default_factory=list)
    clips: list[Clip] = field(default_factory=list)

    @property
    def num_shots(self) -> int:
        return ceil(self.duration_sec / 6)

    @property
    def last_shot_duration(self) -> float:
        remainder = self.duration_sec % 6
        return remainder if remainder > 0 else 6


@dataclass
class Script:
    intro: Scene
    analysis: Scene
    conclusion: Scene
    total_duration_sec: int
    style_notes: str = ""

    @property
    def scenes(self) -> list[tuple[str, Scene]]:
        return [("intro", self.intro), ("analysis", self.analysis), ("conclusion", self.conclusion)]


def parse_script(data: dict) -> Script:
    """JSON dict → Script 객체"""
    def _parse_scene(d: dict) -> Scene:
        clips = [Clip(**c) for c in d.get("clips", [])]
        return Scene(text=d["text"], duration_sec=d["duration_sec"],
                     emphasis=d.get("emphasis", []), clips=clips)

    s = data["script"]
    return Script(
        intro=_parse_scene(s["intro"]),
        analysis=_parse_scene(s["analysis"]),
        conclusion=_parse_scene(s["conclusion"]),
        total_duration_sec=data["total_duration_sec"],
        style_notes=data.get("style_notes", ""),
    )
