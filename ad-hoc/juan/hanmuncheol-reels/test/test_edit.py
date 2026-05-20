"""ffmpeg 편집 기능 테스트 - 영상 생성 없이 로컬만으로"""
import sys, os, subprocess, glob
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from video_edit import concat_videos, overlay_audio


def get_duration(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def test_concat():
    print("=== concat_videos 테스트 ===")
    for src, cmd in [
        ("/tmp/test_a.mp4", "ffmpeg -y -f lavfi -i color=c=blue:s=1280x720:d=6 -c:v libx264 /tmp/test_a.mp4"),
        ("/tmp/test_b.mp4", "ffmpeg -y -f lavfi -i color=c=red:s=1280x720:d=6 -c:v libx264 /tmp/test_b.mp4"),
    ]:
        subprocess.run(cmd.split(), capture_output=True, check=True)
        print(f"  생성: {src}")

    output = "/tmp/test_concat.mp4"
    concat_videos(["/tmp/test_a.mp4", "/tmp/test_b.mp4"], output)
    assert os.path.exists(output), f"❌ {output} 없음"
    dur = get_duration(output)
    ok = abs(dur - 12.0) < 1.0
    print(f"  {'✅' if ok else '❌'} concat 결과: {dur:.1f}s (기대: 12s)")
    return ok


def test_overlay_audio():
    print("\n=== overlay_audio 테스트 ===")
    mp3s = sorted(glob.glob("/tmp/tts_test/*.mp3"))
    if not mp3s:
        print("  ⚠️ /tmp/tts_test/ 에 mp3 없음 - 스킵")
        return True
    output = "/tmp/test_overlay.mp4"
    overlay_audio("/tmp/test_concat.mp4", mp3s[0], output)
    assert os.path.exists(output)
    dur = get_duration(output)
    print(f"  ✅ overlay 결과: {dur:.1f}s")
    return True


if __name__ == "__main__":
    r1 = test_concat()
    r2 = test_overlay_audio()
    print(f"\n{'='*40}")
    print(f"  {'✅' if r1 else '❌'} concat_videos")
    print(f"  {'✅' if r2 else '❌'} overlay_audio")
    if r1 and r2:
        print("\n✅ 모든 편집 테스트 통과")
    else:
        sys.exit(1)
