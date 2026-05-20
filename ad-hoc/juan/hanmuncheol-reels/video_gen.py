"""Nova Reel 영상 생성 + 프레임 추출 + 트림"""
import base64
import subprocess
import time
from config import get_session, S3_BUCKET, MODEL_ID, SHOT_DURATION


def _image_to_base64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def extract_last_frame(video_path: str, output_path: str) -> str:
    """영상의 마지막 프레임을 1280x720 PNG로 추출"""
    subprocess.run([
        "ffmpeg", "-y", "-sseof", "-0.1", "-i", video_path,
        "-vframes", "1", "-s", "1280x720", output_path,
    ], capture_output=True)
    return output_path


def trim_video(input_path: str, duration: float, output_path: str) -> str:
    """영상을 앞에서 duration초만 잘라냄"""
    subprocess.run([
        "ffmpeg", "-y", "-i", input_path,
        "-t", str(duration), "-c", "copy", output_path,
    ], capture_output=True)
    return output_path


def generate_shot(prompt: str, image_path: str, s3_prefix: str, max_retries: int = 2) -> str:
    """
    단일 6초 샷 생성. 실패 시 최대 2회 재시도 (2회째는 seed 변경).
    반환: 로컬 다운로드된 mp4 경로
    """
    import os
    mock = os.environ.get("MOCK_VIDEO_GEN", "").lower() == "true"
    if mock:
        # Mock: 더미 영상 생성
        import subprocess
        local_path = f"/tmp/mock_{s3_prefix.replace('/', '_')}.mp4"
        subprocess.run([
            "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=gray:s=1280x720:d=6",
            "-c:v", "libx264", local_path,
        ], capture_output=True)
        print(f"[VideoGen] MOCK: {local_path}")
        return local_path

    session = get_session()
    bedrock = session.client("bedrock-runtime")
    s3 = session.client("s3")
    image_b64 = _image_to_base64(image_path)

    for attempt in range(max_retries):
        seed = int(time.time()) % 2147483648 if attempt == 0 else int(time.time() + 999) % 2147483648
        s3_uri = f"s3://{S3_BUCKET}/{s3_prefix}/"

        try:
            response = bedrock.start_async_invoke(
                modelId=MODEL_ID,
                modelInput={
                    "taskType": "TEXT_VIDEO",
                    "textToVideoParams": {
                        "text": prompt,
                        "images": [{"format": "png", "source": {"bytes": image_b64}}],
                    },
                    "videoGenerationConfig": {
                        "durationSeconds": SHOT_DURATION,
                        "fps": 24,
                        "dimension": "1280x720",
                        "seed": seed,
                    },
                },
                outputDataConfig={"s3OutputDataConfig": {"s3Uri": s3_uri}},
            )

            arn = response["invocationArn"]
            job_id = arn.split("/")[-1]
            print(f"[VideoGen] Started: {job_id} (attempt {attempt+1})")

            timeout = 180  # 3분
            elapsed = 0
            while elapsed < timeout:
                status = bedrock.get_async_invoke(invocationArn=arn)
                state = status["status"]
                if state == "Completed":
                    local_path = f"/tmp/{job_id}.mp4"
                    s3_key = f"{s3_prefix}/{job_id}/output.mp4"
                    s3.download_file(S3_BUCKET, s3_key, local_path)
                    print(f"[VideoGen] Done: {local_path}")
                    return local_path
                elif state == "Failed":
                    raise RuntimeError(status.get("failureMessage", "unknown"))
                time.sleep(15)
                elapsed += 15

            raise TimeoutError(f"Shot generation timed out after {timeout}s")

        except Exception as e:
            print(f"[VideoGen] Attempt {attempt+1} failed: {e}")
            if attempt == max_retries - 1:
                raise RuntimeError(f"Shot generation failed after {max_retries} attempts: {e}")


def generate_scene_video(prompts: list[str], initial_image: str,
                         duration_sec: int, scene_id: str) -> str:
    """
    씬 전체 영상 생성.
    - duration_sec(SSOT)에 맞춰 샷 생성 + 마지막 샷 트림
    - 이전 샷의 마지막 프레임을 다음 샷 입력으로 사용
    반환: 최종 씬 영상 경로
    """
    from math import ceil
    num_shots = ceil(duration_sec / SHOT_DURATION)
    last_shot_use = duration_sec % SHOT_DURATION or SHOT_DURATION

    shot_videos = []
    current_image = initial_image

    for i in range(num_shots):
        prompt = prompts[i] if i < len(prompts) else prompts[-1]
        s3_prefix = f"scenes/{scene_id}/shot_{i}"

        shot_path = generate_shot(prompt, current_image, s3_prefix)

        # 마지막 샷이면 트림
        if i == num_shots - 1 and last_shot_use < SHOT_DURATION:
            trimmed = f"/tmp/{scene_id}_shot_{i}_trimmed.mp4"
            trim_video(shot_path, last_shot_use, trimmed)
            shot_videos.append(trimmed)
        else:
            shot_videos.append(shot_path)

        # 다음 샷을 위해 마지막 프레임 추출
        if i < num_shots - 1:
            frame_path = f"/tmp/{scene_id}_frame_{i}.png"
            extract_last_frame(shot_path, frame_path)
            current_image = frame_path

    # concat
    output = f"/tmp/{scene_id}_full.mp4"
    concat_list = f"/tmp/{scene_id}_concat.txt"
    with open(concat_list, "w") as f:
        for v in shot_videos:
            f.write(f"file '{v}'\n")

    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_list, "-c", "copy", output,
    ], capture_output=True)

    print(f"[VideoGen] Scene {scene_id}: {duration_sec}s ({num_shots} shots, last={last_shot_use}s)")
    return output
