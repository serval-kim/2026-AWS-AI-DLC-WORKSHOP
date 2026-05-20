variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnets" {
  type = list(string)
}

variable "alb_target_group_arn" {
  type = string
}

variable "api_image_uri" {
  type = string
}

variable "api_cpu" {
  type = number
}

variable "api_memory" {
  type = number
}

variable "api_desired_count" {
  type = number
}

variable "redis_endpoint" {
  type = string
}

variable "opensearch_endpoint" {
  type = string
}

variable "secrets_arn" {
  type = string
}
