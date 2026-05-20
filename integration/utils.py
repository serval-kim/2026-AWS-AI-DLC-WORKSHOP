"""타임스탬프 변환 유틸리티"""


def float_to_ts(seconds: float) -> str:
    """3.5 → '00:03.5', 65.0 → '01:05'"""
    m = int(seconds) // 60
    s = seconds - m * 60
    if s == int(s):
        return f"{m:02d}:{int(s):02d}"
    return f"{m:02d}:{s:04.1f}"


def ts_to_float(ts: str) -> float:
    """'00:03.5' → 3.5, '01:05' → 65.0"""
    parts = ts.split(":")
    m = int(parts[0])
    s = float(parts[1])
    return m * 60 + s
