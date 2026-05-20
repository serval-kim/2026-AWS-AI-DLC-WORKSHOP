"""전체 파이프라인 오케스트레이션"""
import json
import os
from models import parse_script, Scene
from config import BASE_IMAGE
from tts import generate_tts
from prompt_builder import build_prompt
from video_gen import generate_scene_video
from video_edit import concat_videos, compose_scene


def run_pipeline(script_path: str, output_dir: str = "/tmp/reels_output",
                 mode: str = "serial") -> str:
    """
    전체 파이프라인 실행.
    JSON duration_sec = SSOT. 모든 출력이 이 값에 맞춰짐.
    
    mode: "serial" (연속성 우선) | "parallel" (속도 우선)
    """
    os.makedirs(output_dir, exist_ok=True)

    with open(script_path) as f:
        data = json.load(f)
    script = parse_script(data)

    scene_outputs = []
    current_image = os.path.abspath(BASE_IMAGE)

    for scene_name, scene in script.scenes:
        print(f"\n{'='*40}\n[Pipeline] Scene: {scene_name} ({scene.duration_sec}s, {scene.num_shots} shots)")

        # 1. TTS 생성 (duration SSOT에 맞춤)
        tts_path = os.path.join(output_dir, f"{scene_name}_tts.mp3")
        generate_tts(scene.text, scene.duration_sec, tts_path, scene.emphasis)

        # 2. 프롬프트 생성 (샷별)
        prompts = [
            build_prompt(scene_name, i, scene.num_shots, scene.clips[0].desc if scene.clips else "")
            for i in range(scene.num_shots)
        ]

        # 3. 영상 생성 (duration SSOT에 맞춰 트림)
        video_path = generate_scene_video(prompts, current_image, scene.duration_sec, scene_name, mode=mode)

        # 4. 씬 합성 (영상 + TTS)
        scene_output = os.path.join(output_dir, f"{scene_name}_final.mp4")
        compose_scene(video_path, tts_path, scene_output)
        scene_outputs.append(scene_output)

        # 다음 씬을 위해 마지막 프레임 갱신
        from video_gen import extract_last_frame
        current_image = os.path.join(output_dir, f"{scene_name}_last_frame.png")
        extract_last_frame(video_path, current_image)

    # 5. 전체 결합
    final_output = os.path.join(output_dir, "hanmuncheol_reels.mp4")
    concat_videos(scene_outputs, final_output)
    print(f"\n[Pipeline] Done: {final_output} (target: {script.total_duration_sec}s)")
    return final_output


if __name__ == "__main__":
    import sys
    script_file = sys.argv[1] if len(sys.argv) > 1 else "test/sample_script.json"
    mode = sys.argv[2] if len(sys.argv) > 2 else "serial"
    print(f"[Pipeline] Mode: {mode}")
    run_pipeline(script_file, mode=mode)
