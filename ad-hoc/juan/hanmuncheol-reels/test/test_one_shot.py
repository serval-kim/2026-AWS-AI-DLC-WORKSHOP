"""Nova Reel 1샷(6초) 생성 + 마지막 프레임 추출 + 트림 테스트"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from video_gen import generate_shot, extract_last_frame, trim_video

IMAGE = "/Users/juahn.jeong/IdeaProjects/aws_temp/ad-hoc/juan/image_padded.png"
PROMPT = "Korean male lawyer in navy suit speaking to camera"


def check_file(label, path):
    if os.path.exists(path):
        size_mb = os.path.getsize(path) / 1024 / 1024
        print(f"  ✅ {label}: {path} ({size_mb:.2f} MB)")
        return True
    print(f"  ❌ {label}: NOT FOUND - {path}")
    return False


if __name__ == "__main__":
    print("=== Step 1: generate_shot (6s) ===")
    video_path = generate_shot(PROMPT, IMAGE, "test/one_shot")
    ok1 = check_file("Generated video", video_path)

    print("\n=== Step 2: extract_last_frame ===")
    frame_path = "/tmp/test_one_shot_last_frame.png"
    extract_last_frame(video_path, frame_path)
    ok2 = check_file("Last frame", frame_path)

    print("\n=== Step 3: trim_video (4s) ===")
    trimmed_path = "/tmp/test_one_shot_trimmed.mp4"
    trim_video(video_path, 4, trimmed_path)
    ok3 = check_file("Trimmed video", trimmed_path)

    print(f"\n{'='*40}")
    if ok1 and ok2 and ok3:
        print("✅ 영상 생성 테스트 모두 통과")
    else:
        print("❌ 일부 실패")
        sys.exit(1)
