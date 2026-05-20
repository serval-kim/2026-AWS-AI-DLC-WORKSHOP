output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "alb_dns_name" {
  description = "ALB DNS name for API server"
  value       = module.networking.alb_dns_name
}

output "ecr_api_repository_url" {
  description = "ECR repository URL for api-server image"
  value       = module.ecr.api_repository_url
}

output "ecr_worker_repository_url" {
  description = "ECR repository URL for worker image"
  value       = module.ecr.worker_repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = module.elasticache.primary_endpoint
}

output "opensearch_endpoint" {
  description = "OpenSearch domain endpoint"
  value       = module.opensearch.domain_endpoint
}

output "s3_data_bucket" {
  description = "S3 data bucket name"
  value       = module.s3.data_bucket_name
}

output "worker_asg_name" {
  description = "Worker Auto Scaling Group name"
  value       = module.ec2_worker.asg_name
}
