"""End-to-end test script for VideoAnalyzer + FaultAnalyzer + ScriptGenerator.

Usage:
    # List available videos in S3
    python scripts/test_analysis_e2e.py --list

    # Run full pipeline on a specific video
    python scripts/test_analysis_e2e.py --video accident-videos/sample1.mp4

    # Run full pipeline on first available video
    python scripts/test_analysis_e2e.py --first

    # Run only video analysis (skip LLM calls)
    python scripts/test_analysis_e2e.py --video accident-videos/sample1.mp4 --video-only
"""

import argparse
import json
import sys
import tempfile
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import boto3

from shared.config import settings
from shared.logging import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)

S3_BUCKET = "accident-blackbox"
S3_PREFIX = "accident-videos/"


def get_s3_client():
    """Create S3 client using environment variables."""
    import os
    return boto3.client(
        "s3",
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", settings.aws_access_key_id),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", settings.aws_secret_access_key),
        aws_session_token=os.environ.get("AWS_SESSION_TOKEN", settings.aws_session_token) or None,
        region_name=os.environ.get("AWS_DEFAULT_REGION", settings.effective_region),
    )


def list_videos() -> list[str]:
    """List all video files in the S3 bucket."""
    s3 = get_s3_client()
    response = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=S3_PREFIX)

    videos = []
    for obj in response.get("Contents", []):
        key = obj["Key"]
        if key.lower().endswith((".mp4", ".avi", ".mov")):
            videos.append(key)
            print(f"  📹 {key} ({obj['Size'] / 1024 / 1024:.1f} MB)")

    if not videos:
        print("❌ No videos found in s3://accident-blackbox/accident-videos/")

    return videos


def download_video(s3_key: str, local_dir: str) -> str:
    """Download video from S3 to local path."""
    s3 = get_s3_client()
    filename = Path(s3_key).name
    local_path = str(Path(local_dir) / filename)

    print(f"\n⬇️  Downloading s3://{S3_BUCKET}/{s3_key}...")
    s3.download_file(S3_BUCKET, s3_key, local_path)
    print(f"   → Saved to {local_path}")

    return local_path


def run_video_analysis(video_path: str, job_id: str):
    """Run VideoAnalyzer on the video."""
    from worker.video_analyzer import VideoAnalyzer

    print("\n" + "=" * 60)
    print("🎬 STAGE 1: Video Analysis")
    print("=" * 60)

    analyzer = VideoAnalyzer()

    # Step 1: Extract frames
    print("\n📐 Extracting frames (2 FPS)...")
    start = time.time()
    frames, metadata = analyzer.extract_frames(video_path)
    elapsed = time.time() - start
    print(f"   ✅ {len(frames)} frames extracted in {elapsed:.1f}s")
    print(f"   📊 Video: {metadata.width}x{metadata.height}, {metadata.duration:.1f}s, {metadata.fps:.0f} FPS")

    # Step 2: Object detection
    print("\n🔍 Running YOLOv8 object detection...")
    start = time.time()
    detections = analyzer.detect_objects(frames)
    elapsed = time.time() - start

    total_objects = sum(len(d.objects) for d in detections)
    vehicle_frames = sum(1 for d in detections if any(o.class_name in {"car", "truck", "bus", "motorcycle"} for o in d.objects))
    print(f"   ✅ {total_objects} objects detected across {len(detections)} frames in {elapsed:.1f}s")
    print(f"   🚗 Vehicles found in {vehicle_frames}/{len(detections)} frames ({vehicle_frames/max(len(detections),1)*100:.0f}%)")

    # Show detection breakdown
    class_counts = {}
    for d in detections:
        for obj in d.objects:
            class_counts[obj.class_name] = class_counts.get(obj.class_name, 0) + 1
    for cls, count in sorted(class_counts.items(), key=lambda x: -x[1]):
        print(f"      - {cls}: {count}")

    # Step 3: Vehicle tracking
    print("\n🏎️  Tracking vehicles (ByteTrack)...")
    start = time.time()
    tracks = analyzer.track_vehicles(detections)
    elapsed = time.time() - start
    print(f"   ✅ {len(tracks)} vehicles tracked in {elapsed:.1f}s")
    for track in tracks[:5]:
        duration = track.last_seen - track.first_seen
        print(f"      - Vehicle {track.vehicle_id}: {len(track.track_points)} points, {duration:.1f}s")

    # Step 4: Accident classification
    print("\n⚠️  Classifying accident type...")
    traffic_lights = analyzer._extract_traffic_lights(detections)
    accident = analyzer.classify_accident(tracks, traffic_lights)
    print(f"   ✅ Type: {accident.accident_type} (confidence: {accident.confidence:.2f})")
    print(f"   📝 Details: {accident.details}")
    print(f"   🚗 Involved vehicles: {accident.involved_vehicles}")

    # Build full result
    from shared.models.video import VideoAnalysisResult
    result = VideoAnalysisResult(
        job_id=job_id,
        video_duration=metadata.duration,
        total_frames=len(frames),
        fps_extracted=settings.video_extract_fps,
        detections=detections,
        vehicle_tracks=tracks,
        traffic_lights=traffic_lights,
        accident=accident,
        metadata=metadata,
        ego_vehicle_id=0,
    )

    return result


def run_fault_analysis(video_analysis):
    """Run FaultAnalyzer on video analysis results."""
    from worker.fault_analyzer import FaultAnalyzer

    print("\n" + "=" * 60)
    print("⚖️  STAGE 2: Fault Analysis (RAG + LLM)")
    print("=" * 60)

    analyzer = FaultAnalyzer()

    # RAG search
    print("\n🔎 Searching legal references (OpenSearch RAG)...")
    try:
        references = analyzer.search_references(video_analysis)
        print(f"   ✅ {len(references)} references found")
        for ref in references[:3]:
            print(f"      - [{ref.category}] {ref.source} (score: {ref.relevance_score:.2f})")
    except Exception as e:
        print(f"   ⚠️  RAG search failed: {e}")
        print("   → Proceeding without RAG context")
        references = []

    # LLM fault analysis
    print("\n🤖 Invoking LLM for fault ratio analysis (Extended Thinking)...")
    start = time.time()
    try:
        fault_result = analyzer.analyze_fault(video_analysis, references)
        elapsed = time.time() - start
        print(f"   ✅ Fault analysis complete in {elapsed:.1f}s")

        if fault_result.undetermined:
            print(f"   ⚠️  Undetermined: {fault_result.undetermined_reason}")
        else:
            print(f"   📊 Confidence: {fault_result.confidence:.2f}")
            for ratio in fault_result.ratios:
                vehicle_label = "자차(블랙박스)" if ratio.vehicle_id == 0 else f"상대차량 {ratio.vehicle_id}"
                print(f"      - {vehicle_label}: {ratio.ratio_percent}%")
                if ratio.key_faults:
                    print(f"        과실: {', '.join(ratio.key_faults)}")
            print(f"\n   📝 Reasoning: {fault_result.reasoning[:200]}...")

        fault_result.references = references
        return fault_result

    except Exception as e:
        print(f"   ❌ Fault analysis failed: {e}")
        return None


def run_script_generation(fault_result, video_analysis):
    """Run ScriptGenerator on fault analysis results."""
    from worker.script_generator import ScriptGenerator

    print("\n" + "=" * 60)
    print("📝 STAGE 3: Structured Analysis Generation")
    print("=" * 60)

    generator = ScriptGenerator()

    print("\n🤖 Generating 3-part structured analysis...")
    start = time.time()
    try:
        structured = generator.run(fault_result, video_analysis)
        elapsed = time.time() - start
        print(f"   ✅ Structured analysis generated in {elapsed:.1f}s")

        print(f"\n   📖 도입부: {structured.intro.summary}")
        print(f"   📊 분석부: {len(structured.analysis.driver_actions)} driver actions")
        for action in structured.analysis.driver_actions:
            vehicle_label = "자차" if action.vehicle_id == 0 else f"차량 {action.vehicle_id}"
            print(f"      - {vehicle_label}: {action.action} ({action.fault_point})")
        print(f"   ⚖️  결론부: {len(structured.conclusion.fault_ratios)} vehicles")
        for ratio in structured.conclusion.fault_ratios:
            print(f"      - Vehicle {ratio.get('vehicle_id', '?')}: {ratio.get('ratio_percent', '?')}%")

        return structured

    except Exception as e:
        print(f"   ❌ Script generation failed: {e}")
        return None


def save_results(video_analysis, fault_result, structured, output_dir: str):
    """Save all results to local files."""
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    if video_analysis:
        path = output / "video_analysis.json"
        path.write_text(json.dumps(video_analysis.model_dump(mode="json"), ensure_ascii=False, indent=2, default=str))
        print(f"\n💾 Video analysis → {path}")

    if fault_result:
        path = output / "fault_result.json"
        path.write_text(json.dumps(fault_result.model_dump(mode="json"), ensure_ascii=False, indent=2, default=str))
        print(f"💾 Fault result → {path}")

    if structured:
        path = output / "structured_analysis.json"
        path.write_text(json.dumps(structured.model_dump(mode="json"), ensure_ascii=False, indent=2, default=str))
        print(f"💾 Structured analysis → {path}")


def main():
    parser = argparse.ArgumentParser(description="E2E test for accident analysis pipeline")
    parser.add_argument("--list", action="store_true", help="List available videos in S3")
    parser.add_argument("--video", type=str, help="S3 key of video to analyze")
    parser.add_argument("--first", action="store_true", help="Use first available video")
    parser.add_argument("--video-only", action="store_true", help="Run only video analysis (skip LLM)")
    parser.add_argument("--output", type=str, default="test_output", help="Output directory for results")
    args = parser.parse_args()

    print("🚀 Accident Analysis E2E Test")
    print(f"   Bucket: s3://{S3_BUCKET}/{S3_PREFIX}")
    print(f"   Region: {settings.aws_region}")
    print()

    if args.list:
        print("📋 Available videos:")
        list_videos()
        return

    # Determine which video to use
    video_key = args.video
    if args.first or not video_key:
        videos = list_videos()
        if not videos:
            sys.exit(1)
        video_key = videos[0]
        print(f"\n→ Using: {video_key}")

    # Download video
    tmp_dir = tempfile.mkdtemp(prefix="e2e_test_")
    video_path = download_video(video_key, tmp_dir)

    job_id = f"e2e-test-{int(time.time())}"

    # Stage 1: Video Analysis
    video_analysis = run_video_analysis(video_path, job_id)

    fault_result = None
    structured = None

    if not args.video_only:
        # Stage 2: Fault Analysis
        fault_result = run_fault_analysis(video_analysis)

        # Stage 3: Script Generation
        if fault_result and not fault_result.undetermined:
            structured = run_script_generation(fault_result, video_analysis)

    # Save results
    save_results(video_analysis, fault_result, structured, args.output)

    # Copy input video to output dir for comparison
    import shutil
    video_output = Path(args.output) / f"input_video{Path(video_path).suffix}"
    shutil.copy2(video_path, video_output)
    print(f"💾 Input video → {video_output}")

    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    print(f"   Video: {video_key}")
    print(f"   Frames: {video_analysis.total_frames}")
    print(f"   Vehicles tracked: {len(video_analysis.vehicle_tracks)}")
    print(f"   Accident type: {video_analysis.accident.accident_type}")
    if fault_result:
        print(f"   Fault determined: {'No' if fault_result.undetermined else 'Yes'}")
        if not fault_result.undetermined:
            for r in fault_result.ratios:
                label = "자차" if r.vehicle_id == 0 else f"차량{r.vehicle_id}"
                print(f"   {label}: {r.ratio_percent}%")
    if structured:
        print(f"   Structured output: ✅ Generated")
    print(f"\n   Results saved to: {args.output}/")


if __name__ == "__main__":
    main()
