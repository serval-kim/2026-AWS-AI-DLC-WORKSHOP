# Production environment variables
aws_region    = "us-east-1"
environment   = "prod"
project_name  = "hanmuncheol"

# Networking
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]

# ECS (API Server)
api_cpu           = 512
api_memory        = 1024
api_desired_count = 1

# EC2 Worker (GPU)
worker_instance_type = "g5.xlarge"
worker_use_spot      = true
worker_max_count     = 3

# ElastiCache
redis_node_type = "cache.t3.micro"

# OpenSearch
opensearch_instance_type = "t3.small.search"
opensearch_volume_size   = 20

# S3
s3_bucket_prefix = "hanmuncheol-data"
