# Infrastructure Design

## Overview

2-tier 배포 아키텍처: 로컬 개발(docker-compose) + AWS 프로덕션(EC2 분리).

---

## AWS Infrastructure Map

```
                    Internet
                       |
                       v
              +------------------+
              |   EC2 (t3.medium)|
              |   api-server     |
              |   Docker         |
              +------------------+
                    |         |
          Redis     |         |  HTTP callback
          (internal)|         |
                    v         v
              +------------------+
              |  EC2 (g4dn.xl)   |
              |  video-worker    |
              |  Docker + CUDA   |
              +------------------+
                    |
          +---------+---------+
          |         |         |
          v         v         v
      +------+  +-------+  +----------+
      |  S3  |  |Bedrock|  |OpenSearch |
      |      |  |       |  |Serverless |
      +------+  +-------+  +----------+
```

---

## Compute Infrastructure

### api-server EC2

| Attribute | Value |
|-----------|-------|
| Instance Type | t3.medium (2 vCPU, 4GB RAM) |
| AMI | Amazon Linux 2023 |
| Storage | 20GB gp3 EBS |
| Docker | Docker CE + docker-compose |
| Ports | 8000 (FastAPI), 22 (SSH) |
| Security Group | Inbound: 8000 (VPC), 22 (관리 IP) |

### video-worker EC2

| Attribute | Value |
|-----------|-------|
| Instance Type | g4dn.xlarge (4 vCPU, 16GB RAM, 1x T4 GPU) |
| AMI | Deep Learning AMI (Ubuntu) 또는 Amazon Linux 2023 + NVIDIA Driver |
| Storage | 100GB gp3 EBS (영상 임시 저장) |
| Docker | Docker CE + NVIDIA Container Toolkit |
| Ports | 22 (SSH) |
| Security Group | Inbound: 22 (관리 IP), api-server SG에서 콜백 수신 불필요 (worker→api 방향) |

### Redis

| Attribute | Value |
|-----------|-------|
| Option A (MVP) | EC2 api-server 내 Docker Redis 컨테이너 |
| Option B (확장) | Amazon ElastiCache Redis |
| Port | 6379 (VPC 내부만) |

---

## Storage Infrastructure

### S3 Bucket

| Attribute | Value |
|-----------|-------|
| Bucket Name | `accident-analysis-{account-id}-{region}` |
| Encryption | SSE-S3 (AES-256) — SECURITY-01 |
| Access | HTTPS only (bucket policy) — SECURITY-01 |
| Public Access | Block all public access — SECURITY-09 |
| Lifecycle | 중간 결과 30일 후 삭제, 최종 결과 90일 보관 |

**S3 구조**:
```
s3://accident-analysis-{id}/
├── videos/{job_id}/input.mp4
├── results/{job_id}/
│   ├── video_analysis.json
│   ├── fault_result.json
│   └── structured_analysis.json
└── status/{job_id}.json
```

### OpenSearch Serverless

| Attribute | Value |
|-----------|-------|
| Collection Name | `legal-references` |
| Type | Vector Search |
| Encryption | AWS managed key — SECURITY-01 |
| Access | IAM policy (credentials.env의 IAM 사용자) |
| Index | `legal-references` (k-NN, cosine, dim=1536) |

---

## Networking

### VPC Configuration

| Component | Subnet | Notes |
|-----------|--------|-------|
| api-server EC2 | Public subnet | 외부 접근 필요 시 |
| video-worker EC2 | Private subnet | 외부 접근 불필요, NAT Gateway 통해 AWS 서비스 접근 |
| Redis | api-server와 동일 VPC | 내부 통신 |

### Security Groups

| SG Name | Inbound Rules | Outbound Rules |
|---------|--------------|----------------|
| sg-api | 8000/tcp (0.0.0.0/0 또는 특정 IP), 22/tcp (관리 IP) | All outbound |
| sg-worker | 22/tcp (관리 IP) | All outbound (S3, Bedrock, OpenSearch) |
| sg-redis | 6379/tcp (sg-api, sg-worker) | — |

---

## CI/CD Pipeline (GitHub Actions)

### Workflow: ci.yml (PR 시)
```yaml
trigger: pull_request
steps:
  - checkout
  - setup python 3.11
  - install dependencies
  - run pytest (unit + property-based tests)
  - run pip-audit (vulnerability scan)
  - run ruff (linting)
```

### Workflow: deploy.yml (main 머지 시)
```yaml
trigger: push to main
steps:
  - checkout
  - configure AWS credentials (OIDC or secrets)
  - login to ECR
  - docker build api-server → tag with git SHA
  - docker build video-worker → tag with git SHA
  - push to ECR
  - SSH to api-server EC2 → docker pull + restart
  - SSH to video-worker EC2 → docker pull + restart
```

### ECR Repositories

| Repository | Image Tag Strategy |
|-----------|-------------------|
| `accident-api` | `{git-sha}`, `latest` |
| `accident-worker` | `{git-sha}`, `latest` |

---

## Monitoring & Logging (MVP)

| Aspect | Implementation |
|--------|---------------|
| Application Logs | structlog → stdout → CloudWatch Logs (Docker log driver) |
| Metrics | CloudWatch EC2 기본 메트릭 (CPU, Memory, Disk) |
| Health Check | GET /health endpoint (api-server) |
| Alerting | CloudWatch Alarm (EC2 StatusCheck 실패 시) |

---

## Security Compliance

| Rule | Infrastructure Implementation |
|------|------------------------------|
| SECURITY-01 | S3 SSE-S3 + HTTPS only, OpenSearch AWS managed encryption |
| SECURITY-03 | structlog → CloudWatch Logs via Docker log driver |
| SECURITY-07 | Security Groups: 최소 포트만 개방, Private subnet for worker |
| SECURITY-09 | S3 public access blocked, 에러 응답에 내부 정보 미노출 |
| SECURITY-10 | ECR 이미지 태그 고정 (git SHA), pip-audit in CI |

---

## Local Development (docker-compose)

```yaml
# docker-compose.yml
services:
  api-server:
    build: ./api
    ports: ["8000:8000"]
    env_file: credentials.env
    depends_on: [redis]
    
  video-worker:
    build: ./worker
    env_file: credentials.env
    depends_on: [redis]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

**GPU 없는 환경**: `deploy.resources` 섹션 제거하면 CPU fallback으로 동작.
