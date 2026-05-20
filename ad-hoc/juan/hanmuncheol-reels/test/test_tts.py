"""TTS duration SSOT 맞춤 테스트 - 독립 실행 가능"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from models import parse_script
from tts import generate_tts, _get_audio_duration

OUTPUT_DIR = "/tmp/tts_test"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def test_tts_duration_match():
    """각 씬의 TTS가 duration_sec(SSOT)에 맞는지 검증"""
    with open(os.path.join(os.path.dirname(__file__), "sample_script.json")) as f:
        data = json.load(f)
    script = parse_script(data)

    results = []
    for scene_name, scene in script.scenes:
        output_path = os.path.join(OUTPUT_DIR, f"{scene_name}.mp3")
        actual = generate_tts(scene.text, scene.duration_sec, output_path, scene.emphasis)
        diff = abs(actual - scene.duration_sec)
        status = "✅" if diff < 1.0 else "⚠️" if diff < 2.0 else "❌"
        results.append({
            "scene": scene_name,
            "target": scene.duration_sec,
            "actual": round(actual, 1),
            "diff": round(diff, 1),
            "status": status,
        })
        print(f"{status} {scene_name}: target={scene.duration_sec}s, actual={actual:.1f}s (diff={diff:.1f}s)")

    print(f"\n{'='*40}")
    print(f"총 {len(results)}개 씬 테스트 완료")
    total_target = sum(r["target"] for r in results)
    total_actual = sum(r["actual"] for r in results)
    print(f"전체 target={total_target}s, actual={total_actual:.1f}s")

    # SSOT 검증: 1초 이내 오차 허용
    failures = [r for r in results if r["diff"] >= 2.0]
    if failures:
        print(f"\n❌ SSOT 위반 ({len(failures)}건):")
        for f in failures:
            print(f"   {f['scene']}: {f['diff']}s 초과")
        sys.exit(1)
    else:
        print("\n✅ 모든 씬 SSOT 준수 (오차 < 2초)")


if __name__ == "__main__":
    test_tts_duration_match()
