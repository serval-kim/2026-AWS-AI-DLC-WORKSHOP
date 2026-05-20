variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project identifier used in resource naming"
  type        = string
  default     = "hanmuncheol"
}

# --- Networking ---

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "AZs for multi-AZ deployment"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

# --- ECS (API Server) ---

variable "api_cpu" {
  description = "Fargate task CPU units (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Fargate task memory (MiB)"
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Number of API server tasks"
  type        = number
  default     = 1
}

# --- EC2 Worker ---

variable "worker_instance_type" {
  description = "EC2 instance type for GPU worker"
  type        = string
  default     = "g5.xlarge"
}

variable "worker_use_spot" {
  description = "Use Spot Instances for worker"
  type        = bool
  default     = true
}

variable "worker_max_count" {
  description = "Maximum number of worker instances"
  type        = number
  default     = 3
}

# --- ElastiCache ---

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

# --- OpenSearch ---

variable "opensearch_instance_type" {
  description = "OpenSearch instance type"
  type        = string
  default     = "t3.small.search"
}

variable "opensearch_volume_size" {
  description = "OpenSearch EBS volume size (GB)"
  type        = number
  default     = 20
}

# --- S3 ---

variable "s3_bucket_prefix" {
  description = "S3 bucket name prefix"
  type        = string
  default     = "hanmuncheol-data"
}
