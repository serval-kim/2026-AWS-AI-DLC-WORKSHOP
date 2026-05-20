"""Unit tests for configuration."""

from shared.config import Settings


class TestConfig:
    def test_default_settings(self):
        s = Settings(
            aws_access_key_id="test",
            aws_secret_access_key="test",
        )
        assert s.video_extract_fps == 2
        assert s.video_min_resolution == 144
        assert s.yolo_confidence_threshold == 0.5
        assert s.tracking_iou_threshold == 0.3
        assert s.tracking_min_frames == 5
        assert s.rag_top_k == 5
        assert s.rag_min_score == 0.7

    def test_redis_defaults(self):
        s = Settings(
            aws_access_key_id="test",
            aws_secret_access_key="test",
        )
        assert s.redis_host == "redis"
        assert s.redis_port == 6379
