# Deployment Pipeline Questions

AWS 배포 파이프라인 설계를 위한 질문입니다.

---

## Question 1
AWS 배포 대상 인스턴스 타입은?

A) EC2 단일 인스턴스 — api-server + video-worker를 하나의 GPU 인스턴스에 docker-compose로 배포
B) EC2 분리 — api-server는 일반 인스턴스, video-worker는 GPU 인스턴스 (별도 EC2)
C) ECS (Fargate + EC2 GPU) — api-server는 Fargate, video-worker는 ECS GPU 인스턴스
D) EKS (Kubernetes) — 쿠버네티스 기반 오케스트레이션
X) Other (please describe after [Answer]: tag below)

[Answer]: B. 추후 대규모 트래픽 예상 시 D로 전환

---

## Question 2
CI/CD 파이프라인 도구는?

A) GitHub Actions — GitHub 기반 CI/CD
B) AWS CodePipeline + CodeBuild — AWS 네이티브 파이프라인
C) GitLab CI — GitLab 기반
X) Other (please describe after [Answer]: tag below)

[Answer]:  A.

---

## Question 3
Docker 이미지 레지스트리는?

A) Amazon ECR (Elastic Container Registry) — AWS 관리형
B) Docker Hub — 퍼블릭/프라이빗
C) GitHub Container Registry (ghcr.io)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 4
배포 전략은?

A) 수동 배포 — 로컬에서 빌드 후 EC2에 직접 배포 (SSH/SCP)
B) 자동 배포 — CI/CD에서 빌드 → ECR 푸시 → EC2/ECS 자동 배포
C) IaC (Infrastructure as Code) — Terraform/CDK로 인프라 + 배포 자동화
X) Other (please describe after [Answer]: tag below)

[Answer]: B

