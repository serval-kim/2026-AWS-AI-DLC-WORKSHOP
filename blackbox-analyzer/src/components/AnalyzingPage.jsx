import React, { useState, useEffect } from 'react';

const PIPELINE_STEPS = [
  { id: 'upload',    label: '영상 업로드',       icon: '📤', desc: 'S3 저장 및 분석 ID 생성',         duration: 1200 },
  { id: 'extract',   label: '프레임 추출',        icon: '🎞️', desc: '2 FPS 키프레임 추출 중',          duration: 2000 },
  { id: 'detect',    label: '객체 탐지',          icon: '🔍', desc: '차량·차선·신호등 바운딩 박스',     duration: 2500 },
  { id: 'track',     label: '궤적 추적',          icon: '📍', desc: '차량 이동 경로 분석',              duration: 1800 },
  { id: 'classify',  label: '사고 유형 분류',     icon: '🚗', desc: '추돌·끼어들기·신호위반 판별',     duration: 1500 },
  { id: 'fault',     label: '과실비율 판단',      icon: '⚖️', desc: 'RAG + Claude 법규 분석',          duration: 2200 },
  { id: 'script',    label: '스크립트 생성',      icon: '📝', desc: '3단 구조 나레이션 작성',           duration: 1600 },
  { id: 'translate', label: '문철어 번역',        icon: '🗣️', desc: '한문철 스타일 화법 변환',          duration: 1400 },
  { id: 'voice',     label: '음성 생성',          icon: '🎙️', desc: 'TTS 나레이션 MP3 생성',           duration: 1800 },
  { id: 'reels',     label: '릴스 제작',          icon: '🎬', desc: '9:16 세로형 영상 합성',            duration: 2000 },
];

export default function AnalyzingPage({ file, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [scanPos, setScanPos] = useState(0);
  const [detections, setDetections] = useState([]);
  const jobRef = React.useRef(null);

  // API 호출: 분석 시작 + 폴링
  useEffect(() => {
    const API = 'http://localhost:8000';
    let polling = null;

    fetch(`${API}/analyze`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        jobRef.current = data.job_id;
        polling = setInterval(() => {
          fetch(`${API}/jobs/${jobRef.current}`)
            .then(r => r.json())
            .then(job => {
              if (job.status === 'completed') {
                clearInterval(polling);
                // API 결과를 onComplete로 전달
                onComplete({
                  script: job.script,
                  videoUrl: `${API}${job.videoUrl}`,
                  audioUrls: job.audioUrls ? {
                    intro: `${API}${job.audioUrls.intro}`,
                    analysis: `${API}${job.audioUrls.analysis}`,
                    conclusion: `${API}${job.audioUrls.conclusion}`,
                  } : null,
                });
              }
            });
        }, 2000);
      })
      .catch(() => {
        // API 실패 시 기존 mock 동작으로 fallback
        setTimeout(() => onComplete(null), 18000);
      });

    return () => { if (polling) clearInterval(polling); };
  }, []);

  // 스캔 라인 애니메이션
  useEffect(() => {
    const t = setInterval(() => {
      setScanPos(p => (p + 1) % 100);
    }, 30);
    return () => clearInterval(t);
  }, []);

  // 탐지 박스 랜덤 생성
  useEffect(() => {
    const t = setInterval(() => {
      if (currentStep >= 1 && currentStep <= 4) {
        setDetections(prev => {
          const next = [...prev, {
            id: Date.now(),
            x: 10 + Math.random() * 60,
            y: 10 + Math.random() * 60,
            w: 15 + Math.random() * 20,
            h: 10 + Math.random() * 15,
            label: ['차량A', '차량B', '신호등', '차선'][Math.floor(Math.random() * 4)],
            color: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981'][Math.floor(Math.random() * 4)],
          }];
          return next.slice(-6);
        });
      }
    }, 600);
    return () => clearInterval(t);
  }, [currentStep]);

  // 파이프라인 진행
  useEffect(() => {
    if (currentStep >= PIPELINE_STEPS.length) {
      setTimeout(() => onComplete(), 600);
      return;
    }
    const step = PIPELINE_STEPS[currentStep];
    let prog = 0;
    const tick = step.duration / 60;
    const interval = setInterval(() => {
      prog += (100 / 60) * (0.8 + Math.random() * 0.4);
      if (prog >= 100) {
        prog = 100;
        clearInterval(interval);
        setStepProgress(100);
        setTimeout(() => {
          setCompletedSteps(prev => [...prev, currentStep]);
          setCurrentStep(s => s + 1);
          setStepProgress(0);
        }, 300);
      } else {
        setStepProgress(Math.round(prog));
      }
    }, tick);
    return () => clearInterval(interval);
  }, [currentStep]);

  const overallProgress = Math.round(
    ((completedSteps.length + stepProgress / 100) / PIPELINE_STEPS.length) * 100
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e1a 0%, #0f1629 100%)',
      padding: '32px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '32px', animation: 'fadeIn 0.5s ease' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: '#3b82f611', border: '1px solid #3b82f633',
          borderRadius: '100px', padding: '5px 14px',
          fontSize: '11px', color: '#3b82f6', fontWeight: '600',
          letterSpacing: '0.1em', marginBottom: '12px',
        }}>
          <span style={{ width: '6px', height: '6px', background: '#3b82f6', borderRadius: '50%', animation: 'blink 1s infinite' }} />
          AI 분석 진행 중
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#f1f5f9', marginBottom: '4px' }}>
          블랙박스 영상 분석 중...
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '13px' }}>{file?.name}</p>
      </div>

      <div style={{ width: '100%', maxWidth: '900px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left: Video Mock */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Video Frame */}
          <div style={{
            background: '#000',
            border: '1px solid #1e2d4a',
            borderRadius: '16px',
            overflow: 'hidden',
            aspectRatio: '16/9',
            position: 'relative',
          }}>
            {/* Mock road scene */}
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(180deg, #1a2a1a 0%, #2d3a1a 40%, #3a3020 60%, #1a1a2a 100%)',
              position: 'relative',
            }}>
              {/* Road */}
              <div style={{
                position: 'absolute', bottom: '20%', left: '50%',
                transform: 'translateX(-50%)',
                width: '60%', height: '35%',
                background: '#2a2a2a',
                clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
              }} />
              {/* Lane markings */}
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  position: 'absolute',
                  bottom: `${25 + i * 5}%`,
                  left: '50%', transform: 'translateX(-50%)',
                  width: '4px', height: '8%',
                  background: '#f59e0b88',
                }} />
              ))}
              {/* Mock cars */}
              <div style={{
                position: 'absolute', bottom: '28%', left: '42%',
                width: '12%', height: '10%',
                background: '#ef4444',
                borderRadius: '3px',
                boxShadow: '0 0 10px #ef444488',
              }} />
              <div style={{
                position: 'absolute', bottom: '38%', left: '46%',
                width: '10%', height: '8%',
                background: '#3b82f6',
                borderRadius: '3px',
                boxShadow: '0 0 10px #3b82f688',
              }} />

              {/* Detection boxes */}
              {detections.map(d => (
                <div key={d.id} style={{
                  position: 'absolute',
                  left: `${d.x}%`, top: `${d.y}%`,
                  width: `${d.w}%`, height: `${d.h}%`,
                  border: `2px solid ${d.color}`,
                  borderRadius: '2px',
                  animation: 'fadeIn 0.2s ease',
                }}>
                  <span style={{
                    position: 'absolute', top: '-18px', left: '0',
                    background: d.color, color: '#fff',
                    fontSize: '9px', padding: '1px 4px',
                    borderRadius: '2px', whiteSpace: 'nowrap',
                    fontWeight: '700',
                  }}>{d.label}</span>
                </div>
              ))}

              {/* Scan line */}
              <div style={{
                position: 'absolute', left: 0, right: 0,
                top: `${scanPos}%`, height: '2px',
                background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)',
                opacity: 0.7,
              }} />

              {/* Corner brackets */}
              {[
                { top: '8px', left: '8px', borderTop: '2px solid #06b6d4', borderLeft: '2px solid #06b6d4' },
                { top: '8px', right: '8px', borderTop: '2px solid #06b6d4', borderRight: '2px solid #06b6d4' },
                { bottom: '8px', left: '8px', borderBottom: '2px solid #06b6d4', borderLeft: '2px solid #06b6d4' },
                { bottom: '8px', right: '8px', borderBottom: '2px solid #06b6d4', borderRight: '2px solid #06b6d4' },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: '16px', height: '16px', ...s }} />
              ))}

              {/* REC indicator */}
              <div style={{
                position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: '5px',
                background: '#00000088', borderRadius: '4px', padding: '3px 8px',
              }}>
                <span style={{ width: '6px', height: '6px', background: '#ef4444', borderRadius: '50%', animation: 'blink 1s infinite' }} />
                <span style={{ color: '#fff', fontSize: '10px', fontWeight: '700' }}>ANALYZING</span>
              </div>

              {/* Timestamp */}
              <div style={{
                position: 'absolute', bottom: '8px', right: '10px',
                color: '#ffffff88', fontSize: '10px', fontFamily: 'monospace',
              }}>
                00:{String(Math.floor(scanPos * 0.6)).padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Overall Progress */}
          <div style={{
            background: '#141c2e',
            border: '1px solid #1e2d4a',
            borderRadius: '14px',
            padding: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600' }}>전체 진행률</span>
              <span style={{
                fontSize: '28px', fontWeight: '900',
                background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>{overallProgress}%</span>
            </div>
            <div style={{ background: '#0a0e1a', borderRadius: '100px', height: '10px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${overallProgress}%`,
                background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                borderRadius: '100px',
                transition: 'width 0.3s ease',
                boxShadow: '0 0 10px rgba(59,130,246,0.5)',
              }} />
            </div>
            {currentStep < PIPELINE_STEPS.length && (
              <p style={{ color: '#475569', fontSize: '12px', marginTop: '10px', textAlign: 'center' }}>
                {PIPELINE_STEPS[currentStep]?.desc}
              </p>
            )}
          </div>
        </div>

        {/* Right: Pipeline Steps */}
        <div style={{
          background: '#141c2e',
          border: '1px solid #1e2d4a',
          borderRadius: '16px',
          padding: '20px',
          overflowY: 'auto',
          maxHeight: '520px',
        }}>
          <h3 style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', letterSpacing: '0.1em', marginBottom: '16px' }}>
            분석 파이프라인
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PIPELINE_STEPS.map((step, idx) => {
              const isDone = completedSteps.includes(idx);
              const isActive = currentStep === idx;
              const isPending = idx > currentStep;

              return (
                <div key={step.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px',
                  background: isActive ? '#3b82f611' : isDone ? '#10b98108' : 'transparent',
                  border: `1px solid ${isActive ? '#3b82f633' : isDone ? '#10b98122' : '#1e2d4a'}`,
                  borderRadius: '10px',
                  transition: 'all 0.3s ease',
                  animation: isActive ? 'fadeIn 0.3s ease' : 'none',
                }}>
                  {/* Status icon */}
                  <div style={{
                    width: '28px', height: '28px', flexShrink: 0,
                    borderRadius: '50%',
                    background: isDone ? '#10b981' : isActive ? '#3b82f6' : '#1e2d4a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px',
                    boxShadow: isActive ? '0 0 12px rgba(59,130,246,0.5)' : 'none',
                  }}>
                    {isDone ? '✓' : isActive ? (
                      <span style={{ animation: 'spin 1s linear infinite', display: 'block', fontSize: '10px' }}>⟳</span>
                    ) : <span style={{ color: '#475569', fontSize: '11px' }}>{idx + 1}</span>}
                  </div>

                  {/* Label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px' }}>{step.icon}</span>
                      <span style={{
                        fontSize: '13px', fontWeight: '600',
                        color: isDone ? '#10b981' : isActive ? '#f1f5f9' : '#475569',
                      }}>{step.label}</span>
                    </div>
                    {isActive && (
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ background: '#0a0e1a', borderRadius: '100px', height: '4px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${stepProgress}%`,
                            background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                            borderRadius: '100px',
                            transition: 'width 0.1s ease',
                          }} />
                        </div>
                        <span style={{ color: '#3b82f6', fontSize: '10px', marginTop: '2px', display: 'block' }}>
                          {stepProgress}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
