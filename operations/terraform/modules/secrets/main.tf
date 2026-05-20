# =============================================================================
# Secrets Module — AWS Secrets Manager
# =============================================================================

resource "aws_secretsmanager_secret" "app" {
  name        = "${var.project_name}/${var.environment}/app-secrets"
  description = "Application secrets for ${var.project_name} (OpenSearch credentials, API keys)"

  tags = { Name = "${var.project_name}-app-secrets" }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    OPENSEARCH_BASIC_AUTH_USER     = "admin"
    OPENSEARCH_BASIC_AUTH_PASSWORD = "CHANGE_ME"
    RAG_LLM_MODEL_ID              = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
