# =============================================================================
# EC2 Worker Module — GPU Worker (Spot Instance + ASG)
# =============================================================================

data "aws_ami" "gpu" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["Deep Learning AMI GPU PyTorch *-Ubuntu 22.04-*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# --- IAM Role ---

resource "aws_iam_role" "worker" {
  name = "${var.project_name}-worker"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "worker_permissions" {
  name = "${var.project_name}-worker-permissions"
  role = aws_iam_role.worker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:Converse",
          "bedrock:StartAsyncInvoke",
          "bedrock:GetAsyncInvoke",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:DeleteObject",
        ]
        Resource = ["arn:aws:s3:::${var.project_name}-*", "arn:aws:s3:::${var.project_name}-*/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [var.secrets_arn]
      },
      {
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_instance_profile" "worker" {
  name = "${var.project_name}-worker-profile"
  role = aws_iam_role.worker.name
}

# --- Security Group ---

resource "aws_security_group" "worker" {
  name_prefix = "${var.project_name}-worker-"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-worker-sg" }
}

# --- Launch Template ---

resource "aws_launch_template" "worker" {
  name_prefix   = "${var.project_name}-worker-"
  image_id      = data.aws_ami.gpu.id
  instance_type = var.instance_type

  iam_instance_profile {
    arn = aws_iam_instance_profile.worker.arn
  }

  vpc_security_group_ids = [aws_security_group.worker.id]

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e

    # Install Docker
    apt-get update && apt-get install -y docker.io
    systemctl enable docker && systemctl start docker

    # Login to ECR
    aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${var.worker_image_uri}

    # Pull and run worker
    docker pull ${var.worker_image_uri}:latest
    docker run -d --gpus all \
      --restart=always \
      --name worker \
      -e REDIS_HOST=${var.redis_endpoint} \
      -e OPENSEARCH_ENDPOINT=https://${var.opensearch_endpoint} \
      -e AWS_DEFAULT_REGION=us-east-1 \
      ${var.worker_image_uri}:latest
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-worker"
    }
  }
}

# --- Auto Scaling Group ---

resource "aws_autoscaling_group" "worker" {
  name                = "${var.project_name}-worker-asg"
  desired_capacity    = 1
  min_size            = 0
  max_size            = var.max_count
  vpc_zone_identifier = var.private_subnets

  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = var.use_spot ? 0 : 1
      on_demand_percentage_above_base_capacity = var.use_spot ? 0 : 100
      spot_allocation_strategy                 = "capacity-optimized"
    }

    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.worker.id
        version            = "$Latest"
      }
    }
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-worker"
    propagate_at_launch = true
  }
}

# --- Scale based on Redis queue depth (CloudWatch custom metric) ---

resource "aws_autoscaling_policy" "scale_up" {
  name                   = "${var.project_name}-worker-scale-up"
  autoscaling_group_name = aws_autoscaling_group.worker.name
  policy_type            = "SimpleScaling"
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = 1
  cooldown               = 300
}

resource "aws_autoscaling_policy" "scale_down" {
  name                   = "${var.project_name}-worker-scale-down"
  autoscaling_group_name = aws_autoscaling_group.worker.name
  policy_type            = "SimpleScaling"
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = -1
  cooldown               = 600
}
