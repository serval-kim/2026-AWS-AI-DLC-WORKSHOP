"""Polly TTS - duration SSOT에 맞춰 속도 조절"""
import subprocess
import os
import tempfile
from config import get_session, POLLY_VOICE, POLLY_ENGINE


def _get_audio_duration(path: str) -> float:
    """ffprobe로 오디오 길이 측정"""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True,
    )
    return float(result.stdout.strip())


def _build_ssml(text: str, rate_percent: int = 100, emphasis_words: list[str] = None) -> str:
    """SSML 생성 (rate 조절). neural 엔진은 emphasis 미지원이므로 제거."""
    processed = text.replace("**", "")
    return f'<speak><prosody rate="{rate_percent}%">{processed}</prosody></speak>'


def generate_tts(text: str, duration_sec: int, output_path: str,
                 emphasis_words: list[str] = None) -> float:
    """
    TTS 생성 - duration_sec(SSOT)에 맞춰 prosody rate 조절.
    1차: 기본 속도로 생성 → 길이 측정
    2차: rate 계산 후 재생성
    반환: 실제 오디오 길이(초)
    """
    session = get_session()
    polly = session.client("polly")

    # 1차: 기본 속도로 생성하여 길이 측정
    ssml_first = _build_ssml(text, 100, emphasis_words)
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        resp = polly.synthesize_speech(
            Text=ssml_first, TextType="ssml",
            OutputFormat="mp3", VoiceId=POLLY_VOICE, Engine=POLLY_ENGINE,
        )
        tmp.write(resp["AudioStream"].read())
        tmp_path = tmp.name

    actual_duration = _get_audio_duration(tmp_path)

    # 2차: rate 계산 후 재생성
    rate_percent = int((actual_duration / duration_sec) * 100)
    rate_percent = max(20, min(200, rate_percent))  # Polly 허용 범위

    ssml_final = _build_ssml(text, rate_percent, emphasis_words)
    resp = polly.synthesize_speech(
        Text=ssml_final, TextType="ssml",
        OutputFormat="mp3", VoiceId=POLLY_VOICE, Engine=POLLY_ENGINE,
    )
    with open(output_path, "wb") as f:
        f.write(resp["AudioStream"].read())

    final_duration = _get_audio_duration(output_path)
    print(f"[TTS] target={duration_sec}s, actual={final_duration:.1f}s, rate={rate_percent}%")

    # SSOT 보정: 오차 처리
    diff = final_duration - duration_sec
    if abs(diff) > 0.3:
        if diff < 0:
            # 짧음 → silence padding
            padded = output_path + ".padded.mp3"
            subprocess.run([
                "ffmpeg", "-y", "-i", output_path,
                "-af", f"apad=pad_dur={abs(diff)}", "-t", str(duration_sec), padded,
            ], capture_output=True)
            os.replace(padded, output_path)
        else:
            # 김 → trim
            trimmed = output_path + ".trimmed.mp3"
            subprocess.run([
                "ffmpeg", "-y", "-i", output_path,
                "-t", str(duration_sec), "-c", "copy", trimmed,
            ], capture_output=True)
            os.replace(trimmed, output_path)
        final_duration = _get_audio_duration(output_path)
        print(f"[TTS] corrected to {final_duration:.1f}s")

    return final_duration
