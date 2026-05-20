import React, { useState, useEffect, useRef } from 'react';
import VideoTemplate from './VideoTemplate';
import VideoEngine from './VideoEngine';


function _formatTime(sec) {
  if (sec == null) return '00:00';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}


function deriveResult(analysisResult) {
  if (!analysisResult) return null;
  const sa = analysisResult.structuredAnalysis;
  const sc = analysisResult.script?.script;
  if (!sa && !sc) return null;

  const ratios = sa?.conclusion?.fault_ratios || [];
  const a = ratios[0]?.ratio_percent ?? 0;
  const b = ratios[1]?.ratio_percent ?? Math.max(0, 100 - a);

  const timeline = (sa?.analysis?.driver_actions || []).map(da => ({
    time: _formatTime(da.timestamp?.start ?? 0),
    event: `차량${da.vehicle_id ?? '?'} — ${da.action ?? ''}`,
  }));

  return {
    analysisId: sa?.job_id ?? analysisResult.script?.job_id ?? '-',
    accidentType: sa?.intro?.accident_type ?? sa?.intro?.summary ?? '사고 분석',
    fault: { a, b },
    faultLabel: {
      a: `차량 ${ratios[0]?.vehicle_id ?? 'A'}`,
      b: `차량 ${ratios[1]?.vehicle_id ?? 'B'}`,
    },
    verdict: `${a}:${b}`,
    laws: sa?.conclusion?.legal_basis || [],
    precedent: sa?.conclusion?.disclaimer ?? '',
    timeline,
    script: {
      intro: sc?.intro?.text ?? '',
      analysis: sc?.analysis?.text ?? '',
      conclusion: sc?.conclusion?.text ?? '',
    },
  };
}

function FaultChart({ a, b, labelA, labelB }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 300); }, []);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        {/* Donut-style bar */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', borderRadius: '100px', overflow: 'hidden', height: '20px', background: '#0a0e1a' }}>
            <div style={{
              width: animated ? `${a}%` : '0%',
              background: 'linear-gradient(90deg, #ef4444, #f97316)',
              transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: '700', color: 'white',
            }}>
              {animated && `${a}%`}
            </div>
            <div style={{
              width: animated ? `${b}%` : '100%',
              background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
              transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: '700', color: 'white',
            }}>
              {animated && `${b}%`}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #ef444411, #f9731611)',
          border: '1px solid #ef444433',
          borderRadius: '12px', padding: '16px', textAlign: 'center',
        }}>
          <div style={{
            fontSize: '42px', fontWeight: '900',
            background: 'linear-gradient(90deg, #ef4444, #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: animated ? 'count-up 0.6s ease' : 'none',
          }}>{a}%</div>
          <div style={{ color: '#fca5a5', fontSize: '12px', fontWeight: '600', marginTop: '4px' }}>
            {labelA}
          </div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #3b82f611, #06b6d411)',
          border: '1px solid #3b82f633',
          borderRadius: '12px', padding: '16px', textAlign: 'center',
        }}>
          <div style={{
            fontSize: '42px', fontWeight: '900',
            background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: animated ? 'count-up 0.6s ease 0.2s both' : 'none',
          }}>{b}%</div>
          <div style={{ color: '#93c5fd', fontSize: '12px', fontWeight: '600', marginTop: '4px' }}>
            {labelB}
          </div>
        </div>
      </div>
    </div>
  );
}


export default function ResultPage({ file, analysisResult, onReset }) {
  const [activeTab, setActiveTab] = useState('fault');
  const [liveSubtitle, setLiveSubtitle] = useState('');

  const result = React.useMemo(() => deriveResult(analysisResult), [analysisResult]);

  // file prop이 File 객체면 Object URL 생성, 없으면 fallback
  const videoSrc = React.useMemo(() => {
    if (file instanceof File) return URL.createObjectURL(file);
    return '/bb_h264.mp4';
  }, [file]);

  React.useEffect(() => {
    return () => {
      if (file instanceof File) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc]);

  if (!result) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e1a 0%, #0f1629 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#94a3b8', fontSize: '14px',
      }}>
        분석 결과가 없습니다.
        <button onClick={onReset} style={{ marginLeft: 16, padding: '6px 14px', background: 'transparent', border: '1px solid #2d4a7a', borderRadius: 8, color: '#3b82f6', cursor: 'pointer' }}>
          다시 시도
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'fault', label: '과실비율', icon: '⚖️' },
    { id: 'timeline', label: '타임라인', icon: '📍' },
    { id: 'script', label: '문철어 스크립트', icon: '🗣️' },
    { id: 'reels', label: '릴스 미리보기', icon: '🎬' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e1a 0%, #0f1629 100%)',
      padding: '32px 20px',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', animation: 'fadeIn 0.5s ease' }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: '#10b98111', border: '1px solid #10b98133',
              borderRadius: '100px', padding: '4px 12px',
              fontSize: '11px', color: '#10b981', fontWeight: '600',
              marginBottom: '8px',
            }}>
              <span>✓</span> 분석 완료
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#f1f5f9' }}>
              사고 분석 결과
            </h2>
            <p style={{ color: '#475569', fontSize: '12px' }}>ID: {result.analysisId}</p>
          </div>
          <button
            onClick={onReset}
            style={{
              background: 'transparent',
              border: '1px solid #2d4a7a',
              borderRadius: '10px',
              color: '#94a3b8',
              padding: '8px 16px',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.color = '#3b82f6'; }}
            onMouseLeave={e => { e.target.style.borderColor = '#2d4a7a'; e.target.style.color = '#94a3b8'; }}
          >
            + 새 영상 분석
          </button>
        </div>

        {/* Verdict Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #141c2e, #1a2540)',
          border: '1px solid #2d4a7a',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '12px',
          animation: 'fadeIn 0.6s ease',
          boxShadow: '0 0 30px rgba(59,130,246,0.1)',
        }}>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>사고 유형</p>
            <p style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '700' }}>{result.accidentType}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>AI 판결</p>
            <div style={{
              fontSize: '40px', fontWeight: '900',
              background: 'linear-gradient(90deg, #ef4444, #f97316)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{result.verdict}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>관련 법규</p>
            {result.laws.map(l => (
              <p key={l} style={{ color: '#3b82f6', fontSize: '12px' }}>• {l}</p>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{
          background: '#ef444408',
          border: '1px solid #ef444422',
          borderRadius: '10px',
          padding: '10px 16px',
          marginBottom: '20px',
          fontSize: '12px', color: '#fca5a5',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>⚠️</span>
          본 분석은 AI 추정치이며 법적 효력이 없습니다. 실제 법적 판단은 전문 변호사와 상담하시기 바랍니다.
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '8px', marginBottom: '20px',
          overflowX: 'auto', paddingBottom: '4px',
        }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 16px',
                background: activeTab === t.id ? 'linear-gradient(135deg, #3b82f6, #06b6d4)' : '#141c2e',
                border: `1px solid ${activeTab === t.id ? 'transparent' : '#1e2d4a'}`,
                borderRadius: '10px',
                color: activeTab === t.id ? '#fff' : '#94a3b8',
                fontSize: '13px', fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ animation: 'fadeIn 0.4s ease' }} key={activeTab}>
          {activeTab === 'fault' && (
            <div style={{
              background: '#141c2e',
              border: '1px solid #1e2d4a',
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2d4a' }}>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '700' }}>과실비율 분석</h3>
                <p style={{ color: '#475569', fontSize: '12px', marginTop: '4px' }}>
                  {result.precedent}
                </p>
              </div>
              <FaultChart a={result.fault.a} b={result.fault.b} labelA={result.faultLabel.a} labelB={result.faultLabel.b} />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div style={{
              background: '#141c2e',
              border: '1px solid #1e2d4a',
              borderRadius: '16px',
              padding: '24px',
            }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>
                사고 타임라인
              </h3>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: '20px', top: 0, bottom: 0,
                  width: '2px', background: 'linear-gradient(180deg, #3b82f6, #06b6d4)',
                }} />
                {result.timeline.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '16px',
                    marginBottom: '20px',
                    paddingLeft: '48px',
                    position: 'relative',
                    animation: `slide-in-right 0.4s ease ${i * 0.1}s both`,
                  }}>
                    <div style={{
                      position: 'absolute', left: '12px',
                      width: '18px', height: '18px',
                      background: '#3b82f6',
                      borderRadius: '50%',
                      border: '3px solid #0a0e1a',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} />
                    <div style={{
                      background: '#0a0e1a',
                      border: '1px solid #1e2d4a',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      flex: 1,
                    }}>
                      <span style={{
                        background: '#3b82f622',
                        color: '#3b82f6',
                        fontSize: '11px', fontWeight: '700',
                        padding: '2px 8px', borderRadius: '4px',
                        marginRight: '10px',
                      }}>{item.time}</span>
                      <span style={{ color: '#f1f5f9', fontSize: '14px' }}>{item.event}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'script' && (
            <div style={{
              background: '#141c2e',
              border: '1px solid #1e2d4a',
              borderRadius: '16px',
              padding: '24px',
            }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>
                🗣️ 한문철 스타일 스크립트
              </h3>
              {[
                { label: '도입부', color: '#3b82f6', text: result.script.intro, time: '00:00 ~ 00:10' },
                { label: '분석부', color: '#f59e0b', text: result.script.analysis, time: '00:10 ~ 00:45' },
                { label: '결론부', color: '#ef4444', text: result.script.conclusion, time: '00:45 ~ 01:00' },
              ].map((s, i) => (
                <div key={i} style={{
                  background: '#0a0e1a',
                  border: `1px solid ${s.color}33`,
                  borderLeft: `4px solid ${s.color}`,
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '12px',
                  animation: `slide-in-right 0.4s ease ${i * 0.15}s both`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{
                      background: `${s.color}22`, color: s.color,
                      fontSize: '11px', fontWeight: '700',
                      padding: '2px 8px', borderRadius: '4px',
                    }}>{s.label}</span>
                    <span style={{ color: '#475569', fontSize: '11px' }}>{s.time}</span>
                  </div>
                  <p style={{ color: '#f1f5f9', fontSize: '15px', lineHeight: '1.7', fontWeight: '500' }}>
                    "{s.text}"
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reels' && (
            <div style={{
              background: '#141c2e',
              border: '1px solid #1e2d4a',
              borderRadius: '16px',
              padding: '24px',
            }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>
                🎬 릴스 미리보기
              </h3>
              <p style={{ color: '#475569', fontSize: '12px', marginBottom: '24px' }}>
                9:16 세로형 · 60초 이내 · MP4
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                {/* VideoTemplate + VideoEngine 통합 */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <VideoTemplate
                    titleLine1={result.accidentType.split(' ')[0]}
                    titleLine2={result.accidentType.split(' ').slice(1).join(' ') || '사고 분석'}
                    subtitle={liveSubtitle || result.script.conclusion}
                    subtitleLabel="AI 판결"
                    scale={0.28}
                    style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 0 24px rgba(0,194,255,.25)' }}
                    videoContent={
                      <VideoEngine
                        src={videoSrc}
                        script={analysisResult?.script}
                        showSubtitle={false}
                        onSubtitleChange={setLiveSubtitle}
                        style={{ width: '100%', height: '100%' }}
                      />
                    }
                    personVideo={analysisResult?.videoUrl || null}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    background: '#0a0e1a', border: '1px solid #1e2d4a',
                    borderRadius: '12px', padding: '16px',
                  }}>
                    <p style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>영상 정보</p>
                    {[
                      ['형식', 'MP4 (H.264)'],
                      ['비율', '9:16 세로형'],
                      ['길이', '약 58초'],
                      ['자막', '포함'],
                      ['워터마크', 'AI 분석 결과 - 참고용'],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e2d4a' }}>
                        <span style={{ color: '#475569', fontSize: '12px' }}>{k}</span>
                        <span style={{ color: '#f1f5f9', fontSize: '12px' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <button style={{
                    width: '100%', padding: '14px',
                    background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                    border: 'none', borderRadius: '12px',
                    color: 'white', fontSize: '14px', fontWeight: '700',
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
                    transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => e.target.style.opacity = '0.85'}
                    onMouseLeave={e => e.target.style.opacity = '1'}
                  >
                    ⬇️ 릴스 다운로드
                  </button>
                  <button style={{
                    width: '100%', padding: '12px',
                    background: 'transparent',
                    border: '1px solid #2d4a7a',
                    borderRadius: '12px',
                    color: '#94a3b8', fontSize: '13px', fontWeight: '600',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.color = '#3b82f6'; }}
                    onMouseLeave={e => { e.target.style.borderColor = '#2d4a7a'; e.target.style.color = '#94a3b8'; }}
                  >
                    📤 공유하기
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
