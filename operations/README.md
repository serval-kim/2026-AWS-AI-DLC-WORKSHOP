# Operations — IaC & CI/CD

블랙박스 사고 분석 시뮬레이터의 프로덕션 인프라를 정의하는 Terraform 코드와 CI/CD 파이프라인입니다.

## 구조

```
operations/
├── terraform/
│   ├── main.tf              # 루트 모듈 (모듈 조합)
│   ├── variables.tf         # 입력 변수
│   ├── outputs.tf           # 출력 값
│   ├── providers.tf         # AWS provider 설정
│   ├── backend.tf           # S3 remote state
│   └── modules/
│       ├── networking/      # VPC, 서브넷, ALB
│       ├── ecr/             # 컨테이너 레지스트리
│       ├── ecs/             # API 서버 (Fargate)
│       ├── ec2-worker/      # GPU 워커 (Spot)
│       ├── elasticache/     # Redis 큐
│       ├── opensearch/      # 법률 RAG 벡터 DB
│       ├── s3/              # 데이터 버킷
│       └── secrets/         # Secrets Manager
├── github-actions/
│   ├── ci.yml               # PR → Lint + Test + Docker Build
│   └── deploy.yml           # Main → ECR Push + ECS Deploy
└── aidlc-docs/              # AI-DLC 산출물
```

## 사용법

```bash
cd operations/terraform
terraform init
terraform plan -var-file="env/prod.tfvars"
terraform apply -var-file="env/prod.tfvars"
```

## 배포 대상

| 컴포넌트 | 인프라 | 비고 |
|----------|--------|------|
| blackbox-analyzer | S3 + CloudFront | 정적 SPA |
| api-server | ECS Fargate (ALB 뒤) | Blue/Green 배포 |
| worker | EC2 g5.xlarge (Spot) | GPU 추론, 큐 기반 스케일링 |
| Redis | ElastiCache | 작업 큐 |
| OpenSearch | 관리형 도메인 | 법률 RAG 벡터 검색 |
| Bedrock | 관리형 서비스 | IaC 불필요 (IAM만 설정) |
