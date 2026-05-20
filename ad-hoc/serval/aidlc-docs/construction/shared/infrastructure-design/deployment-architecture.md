# Deployment Architecture

## Environment Strategy

| Environment | Infrastructure | Purpose |
|-------------|---------------|---------|
| Local | docker-compose (laptop) | 개발 + 단위 테스트 |
| Staging | EC2 (동일 구성, 소형 인스턴스) | 통합 테스트 |
| Production | EC2 분리 (t3.medium + g4dn.xlarge) | 실제 서비스 |

---

## Production Deployment Diagram

```
+-----------------------------------------------------------+
|                        AWS VPC                             |
|                                                           |
|  +------------------+     +---------------------------+   |
|  | Public Subnet    |     | Private Subnet            |   |
|  |                  |     |                           |   |
|  | +-------------+  |     | +----------------------+  |   |
|  | | EC2         |  |     | | EC2 (GPU)            |  |   |
|  | | api-server  |  |     | | video-worker         |  |   |
|  | | t3.medium   |  |     | | g4dn.xlarge          |  |   |
|  | |             |  |     | |                      |  |   |
|  | | Docker:     |  |     | | Docker:              |  |   |
|  | |  - FastAPI  |  |     | |  - Worker            |  |   |
|  | |  - Redis    |  |     | |  - CUDA Runtime      |  |   |
|  | +------+------+  |     | +----------+-----------+  |   |
|  |        |          |     |            |              |   |
|  +--------|----------+     +------------|-------------+    |
|           |                             |                  |
|           |    Redis (TCP 6379)         |                  |
|           +-----------------------------+                  |
|           |                             |                  |
+-----------|-----------------------------|-----------------+
            |                             |
            v                             v
    +-------+-------+            +--------+--------+
    |     S3        |            |    Bedrock      |
    | (영상/결과)   |            | (LLM/Embedding) |
    +---------------+            +-----------------+
                                         |
                                         v
                                 +-------+--------+
                                 |  OpenSearch    |
                                 |  Serverless   |
                                 +---------------+
```

---

## Deployment Process

### Initial Setup (1회)

```bash
# 1. ECR 리포지토리 생성
aws ecr create-repository --repository-name accident-api
aws ecr create-repository --repository-name accident-worker

# 2. EC2 인스턴스 생성 (수동 또는 CloudFormation)
# api-server: t3.medium, Amazon Linux 2023, Docker 설치
# video-worker: g4dn.xlarge, Deep Learning AMI, NVIDIA Container Toolkit

# 3. S3 버킷 생성
aws s3 mb s3://accident-analysis-{account-id}-{region}

# 4. OpenSearch Serverless Collection 생성
# AWS Console 또는 CLI로 vector search collection 생성

# 5. GitHub Secrets 설정
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
# EC2_API_HOST, EC2_WORKER_HOST, EC2_SSH_KEY
```

### Continuous Deployment (자동)

```
git push main
    → GitHub Actions trigger
    → pytest + pip-audit
    → docker build (multi-stage)
    → ECR push (tagged: git SHA)
    → SSH to EC2 api-server:
        docker pull {ecr}/accident-api:{sha}
        docker-compose up -d
    → SSH to EC2 video-worker:
        docker pull {ecr}/accident-worker:{sha}
        docker-compose up -d
```

---

## Scaling Strategy (향후)

### Phase 1 (현재 — MVP)
- 단일 api-server + 단일 video-worker
- Redis Queue로 순차 처리

### Phase 2 (중기)
- Auto Scaling Group for video-worker (GPU 인스턴스)
- 큐 깊이 기반 스케일링
- ALB for api-server

### Phase 3 (장기 — EKS 전환)
- EKS 클러스터
- GPU Node Group (video-worker pods)
- Fargate (api-server pods)
- KEDA (큐 기반 오토스케일링)

---

## Cost Estimation (MVP)

| Resource | Monthly Cost (est.) |
|----------|-------------------|
| EC2 t3.medium (api-server, 24/7) | ~$30 |
| EC2 g4dn.xlarge (worker, on-demand) | ~$380 (24/7) 또는 Spot ~$115 |
| S3 (10GB) | ~$0.23 |
| OpenSearch Serverless (2 OCU) | ~$350 |
| ECR (5GB) | ~$0.50 |
| **Total** | ~$760/month (on-demand) 또는 ~$496 (Spot GPU) |

**비용 최적화 옵션**:
- video-worker: Spot Instance 사용 (70% 절감)
- video-worker: 작업 없을 때 인스턴스 중지 (Lambda 트리거로 시작/중지)
- OpenSearch: 사용량 적으면 로컬 FAISS로 대체 가능
