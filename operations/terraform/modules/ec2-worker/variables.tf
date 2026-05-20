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

variable "instance_type" {
  type = string
}

variable "use_spot" {
  type = bool
}

variable "max_count" {
  type = number
}

variable "worker_image_uri" {
  type = string
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
