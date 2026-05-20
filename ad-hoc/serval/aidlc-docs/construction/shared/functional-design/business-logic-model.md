# Business Logic Model

## Pipeline Flow

```
Input: video_s3_key (S3 영상 경로)
                |
                v
+-----------------------------------+
| Stage 1: Video Analysis           |
| (VideoAnalyzer)                   |
+-----------------------------------+
| 1.1 S3에서 영상 다운로드          |
| 1.2 FFmpeg 프레임 추출 (2 FPS)    |
| 1.3 YOLOv8 객체 탐지             |
| 1.4 ByteTrack 차량 추적          |
| 1.5 사고 유형 분류 (규칙 기반)    |
+-----------------------------------+
        |
        | VideoAnalysisResult
        v
+-----------------------------------+
| Stage 2: Fault Analysis           |
| (FaultAnalyzer)                   |
+-----------------------------------+
| 2.1 분석 결과 → 검색 쿼리 생성   |
| 2.2 OpenSearch RAG 검색           |
| 2.3 프롬프트 구성                 |
| 2.4 Bedrock LLM 호출             |
|     (Extended Thinking)           |
| 2.5 응답 파싱 → FaultResult       |
+-----------------------------------+
        |
        | FaultResult
        v
+-----------------------------------+
| Stage 3: Script Generation        |
| (ScriptGenerator)                 |
+-----------------------------------+
| 3.1 과실비율 + 메타데이터 입력    |
| 3.2 프롬프트 구성 (3단 구조)      |
| 3.3 Bedrock LLM 호출             |
| 3.4 JSON Schema 검증             |
| 3.5 StructuredAnalysis 출력       |
+-----------------------------------+
        |
        | StructuredAnalysis
        v
Output: S3에 결과 저장 + 콜백 전송
```

---

## Stage 1: Video Analysis — Detailed Logic

### 1.1 영상 다운로드
```
Input: video_s3_key
Process:
  - S3Client.download_file(video_s3_key, /tmp/{job_id}/input.{ext})
  - 파일 존재 및 크기 검증
Output: local_video_path
Error: S3 다운로드 실패 → FAILED (recoverable=false)
```

### 1.2 프레임 추출
```
Input: local_video_path, fps=2
Process:
  - FFmpeg으로 영상 메타데이터 추출 (duration, resolution, fps)
  - FFmpeg으로 2 FPS 키프레임 추출
  - 추출된 프레임을 /tmp/{job_id}/frames/ 에 저장
  - 예상 프레임 수 = duration * 2
Output: list[FrameData], VideoMetadata
Error: FFmpeg 실패 → FAILED (recoverable=false, CORRUPTED_VIDEO)
```

### 1.3 객체 탐지
```
Input: list[FrameData]
Process:
  - YOLOv8 모델 로드 (GPU 가능 시 CUDA, 아니면 CPU)
  - 각 프레임에 대해 추론 실행
  - confidence >= 0.5 인 탐지만 유효
  - 탐지 클래스: car, truck, bus, motorcycle, lane, traffic_light
Output: list[DetectionResult]
Error: 모델 로드 실패 → PARTIAL (recoverable=true)
Validation: 전체 프레임 80% 이상에서 차량 0대 → NO_VEHICLE 에러
```

### 1.4 차량 추적
```
Input: list[DetectionResult]
Process:
  - ByteTrack 초기화
  - 프레임 순서대로 탐지 결과 입력
  - IoU >= 0.3 기준으로 동일 차량 매칭
  - 5프레임 이상 연속 탐지된 차량만 유효 궤적
  - 각 차량의 중심점 궤적 계산
Output: list[VehicleTrack]
Error: 추적 실패 → PARTIAL (탐지 결과까지 저장)
```

### 1.5 사고 유형 분류
```
Input: list[VehicleTrack], list[TrafficLightState]
Process:
  - 차량 간 최소 거리 계산 (프레임별)
  - 거리 급감 지점 탐지 (충돌 후보)
  - 규칙 기반 분류:
    * 후방→전방 접근 + 거리 급감 → rear_end
    * 차선 변경 + 인접 차량 근접 → lane_change
    * 적색 신호 + 교차로 진입 → signal_violation
    * 교차로 내 궤적 교차 → intersection
    * 반대 방향 + 거리 급감 → head_on
    * 수직 접근 + 거리 급감 → side_collision
  - 복수 규칙 매칭 시: confidence 높은 것 선택
Output: AccidentClassification
Error: 분류 불가 → UNKNOWN (confidence=0.0), 계속 진행
```

---

## Stage 2: Fault Analysis — Detailed Logic

### 2.1 검색 쿼리 생성
```
Input: VideoAnalysisResult
Process:
  - 사고 유형 + 관련 차량 행동 요약 텍스트 생성
  - 예: "추돌 사고. A차량이 B차량 후방에서 급접근하여 충돌."
  - Bedrock Titan Embeddings로 쿼리 벡터 생성
Output: query_vector (list[float])
```

### 2.2 RAG 검색
```
Input: query_vector, k=5
Process:
  - OpenSearchClient.search(index="legal-references", query_vector, k=5)
  - relevance_score >= 0.7 인 결과만 필터링
Output: list[LegalReference]
Error: OpenSearch 연결 실패 → RAG 없이 LLM 시도 (Partial)
```

### 2.3 프롬프트 구성
```
Input: VideoAnalysisResult, list[LegalReference]
Process:
  - 시스템 프롬프트: 교통사고 과실비율 분석 전문가 역할
  - 컨텍스트: 영상 분석 JSON + RAG 검색 결과
  - 요청: 구조화된 JSON으로 과실비율 + 근거 응답
  - JSON Schema 명시 (structured output)
Output: prompt (str), context (str)
```

### 2.4 LLM 호출
```
Input: prompt, context
Process:
  - BedrockClient.invoke_with_thinking(prompt, context, max_tokens=4096)
  - Extended Thinking 활성화 (복잡한 법적 추론)
  - 응답 파싱: JSON 추출
Output: LLMResponse
Error: Bedrock 호출 실패 → PARTIAL (영상 분석 결과까지 저장)
```

### 2.5 응답 파싱
```
Input: LLMResponse
Process:
  - JSON 파싱 및 FaultResult 모델 매핑
  - 과실비율 합계 검증 (== 100%)
  - 면책 문구 추가
  - 판단 불가 시 undetermined=true 설정
Output: FaultResult
Error: 파싱 실패 → 1회 재호출, 재실패 시 PARTIAL
```

---

## Stage 3: Script Generation — Detailed Logic

### 3.1 입력 준비
```
Input: FaultResult, VideoMetadata, VideoAnalysisResult
Process:
  - 과실비율 결과 + 영상 타임라인 + 차량 궤적 데이터 통합
  - 각 운전자의 핵심 행동 시점 추출
Output: combined_context (dict)
```

### 3.2 프롬프트 구성
```
Input: combined_context
Process:
  - 시스템 프롬프트: 교통사고 분석 리포트 작성 전문가
  - 요청: 3단 구조 (도입부/분석부/결론부) JSON 생성
  - JSON Schema 명시 (StructuredAnalysis 형식)
  - 타임스탬프 매핑 규칙 명시
Output: prompt (str)
```

### 3.3 LLM 호출 + Schema 검증
```
Input: prompt
Process:
  - BedrockClient.invoke_with_thinking(prompt, context, max_tokens=4096)
  - JSON 파싱
  - StructuredAnalysis 모델 검증 (Pydantic)
  - 필수 필드 누락 시 재호출 (최대 2회)
Output: StructuredAnalysis
Error: 검증 실패 3회 → PARTIAL (과실비율 결과까지 저장)
```

---

## Testable Properties (PBT-01)

| Component | Property | Category |
|-----------|----------|----------|
| VideoAnalyzer.extract_frames | frame_count == ceil(duration * fps) | Invariant |
| VideoAnalyzer.detect_objects | 모든 bbox 좌표 0.0~1.0 범위 내 | Invariant |
| VideoAnalyzer.track_vehicles | 유효 궤적의 track_points >= 5 | Invariant |
| FaultAnalyzer.analyze_fault | sum(ratios) == 100 | Invariant |
| FaultAnalyzer.analyze_fault | disclaimer 필드 항상 존재 | Invariant |
| ScriptGenerator.generate_structure | intro + analysis + conclusion 모두 존재 | Invariant |
| ScriptGenerator.generate_structure | 모든 timestamp.start < timestamp.end | Invariant |
| S3Client.upload/download | upload → download == original | Round-trip |
| 모델 직렬화 | model.json() → Model.parse_raw() == original | Round-trip |
| AccidentClassification | confidence 0.0~1.0 범위 | Invariant |
| JobStatus transitions | PENDING→PROCESSING→{COMPLETED,PARTIAL,FAILED} only | Invariant |
