"""Worker entrypoint - Redis Queue consumer."""

import redis
from rq import Worker, Queue

from shared.config import settings
from shared.logging import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)


def start_worker() -> None:
    """Start the RQ worker to consume analysis jobs."""
    logger.info("worker_starting", redis_host=settings.redis_host, queue=settings.redis_queue_name)

    conn = redis.Redis(host=settings.redis_host, port=settings.redis_port)
    queue = Queue(settings.redis_queue_name, connection=conn)

    worker = Worker([queue], connection=conn)
    worker.work()


if __name__ == "__main__":
    start_worker()
