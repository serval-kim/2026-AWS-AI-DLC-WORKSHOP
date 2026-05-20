"""AWS 설정 및 상수"""
import os
import boto3

REGION = "us-east-1"
S3_BUCKET = "nova-reel-poc-880409322612"
MODEL_ID = "amazon.nova-reel-v1:1"
POLLY_VOICE = "Seoyeon"
POLLY_ENGINE = "neural"
SHOT_DURATION = 6  # Nova Reel 고정값
IMAGE_DIM = (1280, 720)
BASE_IMAGE = os.path.join(os.path.dirname(__file__), "..", "image_padded.png")


def get_session() -> boto3.Session:
    return boto3.Session(
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
        aws_session_token=os.environ.get("AWS_SESSION_TOKEN"),
        region_name=REGION,
    )
