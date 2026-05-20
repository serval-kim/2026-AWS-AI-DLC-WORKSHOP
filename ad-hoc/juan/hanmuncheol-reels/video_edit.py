"""ffmpeg 기반 영상 합성"""
import subprocess


def concat_videos(video_paths: list[str], output: str) -> str:
    """영상 리스트를 순서대로 결합"""
    concat_file = "/tmp/final_concat.txt"
    with open(concat_file, "w") as f:
        for v in video_paths:
            f.write(f"file '{v}'\n")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_file, "-c", "copy", output,
    ], capture_output=True, check=True)
    return output


def overlay_audio(video: str, audio: str, output: str) -> str:
    """영상에 오디오 합성 (영상 길이에 맞춤)"""
    subprocess.run([
        "ffmpeg", "-y", "-i", video, "-i", audio,
        "-c:v", "copy", "-c:a", "aac",
        "-map", "0:v", "-map", "1:a", "-shortest", output,
    ], capture_output=True, check=True)
    return output


def add_subtitles(video: str, srt_path: str, output: str) -> str:
    """자막 burn-in"""
    subprocess.run([
        "ffmpeg", "-y", "-i", video,
        "-vf", f"subtitles={srt_path}:force_style='FontSize=24,PrimaryColour=&HFFFFFF&'",
        "-c:a", "copy", output,
    ], capture_output=True, check=True)
    return output


def compose_scene(video: str, audio: str, output: str) -> str:
    """씬 영상 + TTS 오디오 합성"""
    return overlay_audio(video, audio, output)
