# =============================================================================
# Root Module — 한문철 AI 시뮬레이터 인프라
# =============================================================================

module "networking" {
  source = "./modules/networking"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
}

module "ecs" {
  source = "./modules/ecs"

  project_name    = var.project_name
  environment     = var.environment
  vpc_id          = module.networking.vpc_id
  private_subnets = module.networking.private_subnet_ids
  alb_target_group_arn = module.networking.alb_target_group_arn

  api_image_uri   = module.ecr.api_repository_url
  api_cpu         = var.api_cpu
  api_memory      = var.api_memory
  api_desired_count = var.api_desired_count

  redis_endpoint     = module.elasticache.primary_endpoint
  opensearch_endpoint = module.opensearch.domain_endpoint
  secrets_arn        = module.secrets.secret_arn
}

module "ec2_worker" {
  source = "./modules/ec2-worker"

  project_name    = var.project_name
  environment     = var.environment
  vpc_id          = module.networking.vpc_id
  private_subnets = module.networking.private_subnet_ids

  instance_type   = var.worker_instance_type
  use_spot        = var.worker_use_spot
  max_count       = var.worker_max_count

  worker_image_uri   = module.ecr.worker_repository_url
  redis_endpoint     = module.elasticache.primary_endpoint
  opensearch_endpoint = module.opensearch.domain_endpoint
  secrets_arn        = module.secrets.secret_arn
}

module "elasticache" {
  source = "./modules/elasticache"

  project_name    = var.project_name
  environment     = var.environment
  vpc_id          = module.networking.vpc_id
  private_subnets = module.networking.private_subnet_ids
  node_type       = var.redis_node_type
}

module "opensearch" {
  source = "./modules/opensearch"

  project_name    = var.project_name
  environment     = var.environment
  vpc_id          = module.networking.vpc_id
  private_subnets = module.networking.private_subnet_ids
  instance_type   = var.opensearch_instance_type
  volume_size     = var.opensearch_volume_size
}

module "s3" {
  source = "./modules/s3"

  project_name  = var.project_name
  environment   = var.environment
  bucket_prefix = var.s3_bucket_prefix
}

module "secrets" {
  source = "./modules/secrets"

  project_name = var.project_name
  environment  = var.environment
}
