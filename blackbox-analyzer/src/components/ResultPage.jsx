import React, { useState, useEffect, useRef } from 'react';
import VideoTemplate from './VideoTemplate';
import VideoEngine from './VideoEngine';
import MUNCHEOL_SCRIPT from '../assets/muncheol-script-oneshot.json';

const MOCK_RESULT = {
  analysisId: 'ANA-2026-0520-7842',
  accidentType: '끼어들기 후 추돌',
  timestamp: '2026-05-20T14:32:11Z',
  fault: { a: 70, b: 30 },
  faultLabel: { a: '상대 차량 (끼어들기)', b: '내 차량 (블랙박스)' },
  verdict: '7:3',
  laws: ['도로교통법 제19조 (안전거리 확보)', '도로교통법 제23조 (끼어들기 금지)'],
  precedent: '대법원 2023다45821 유사 판례',
  timeline: [
    { time: '00:02', event: '상대 차량 1차선 진입 시도' },
    { time: '00:04', event: '방향지시등 없이 차선 변경' },
    { time: '00:06', event: '충돌 발생' },
    { time: '00:08', event: '양 차량 정차' },
  ],
  script: {
    intro: '자, 보시죠. 이 영상 한번 보겠습니다.',
    analysis: '상대방 차량이 방향지시등도 켜지 않고 갑자기 끼어들었습니다. 이건 명백한 끼어들기 위반이에요.',
    conclusion: '제 판단은 이렇습니다. 7대 3. 끼어든 차량이 7, 당한 차량이 3입니다.',
  },
};

function FaultChart({ a, b }) {
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
            {MOCK_RESULT.faultLabel.a}
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
            {MOCK_RESULT.faultLabel.b}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReelsPlayer() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentLine, setCurrentLine] = useState(0);
  const intervalRef = useRef(null);

  const lines = [
    MOCK_RESULT.script.intro,
    MOCK_RESULT.script.analysis,
    MOCK_RESULT.script.conclusion,
  ];

  function togglePlay() {
    if (playing) {
      clearInterval(intervalRef.current);
      setPlaying(false);
    } else {
      setPlaying(true);
      intervalRef.current = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            clearInterval(intervalRef.current);
            setPlaying(false);
            return 100;
          }
          setCurrentLine(Math.floor((p / 100) * lines.length));
          return p + 0.5;
        });
      }, 150);
    }
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div style={{
      background: '#000',
      borderRadius: '16px',
      overflow: 'hidden',
      aspectRatio: '9/16',
      maxWidth: '240px',
      margin: '0 auto',
      position: 'relative',
      border: '1px solid #1e2d4a',
    }}>
      {/* Video background */}
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(180deg, #1a2a1a 0%, #2d3a1a 40%, #3a3020 60%, #1a1a2a 100%)',
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end',
      }}>
        {/* Mock road scene */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, #0a1a0a 0%, #1a2a10 50%, #2a2010 100%)',
        }}>
          <div style={{
            position: 'absolute', bottom: '30%', left: '50%', transform: 'translateX(-50%)',
            width: '50%', height: '30%',
            background: '#1a1a1a',
            clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)',
          }} />
          <div style={{
            position: 'absolute', bottom: '35%', left: '44%',
            width: '10%', height: '8%',
            background: '#ef4444',
            borderRadius: '2px',
          }} />
          <div style={{
            position: 'absolute', bottom: '43%', left: '47%',
            width: '8%', height: '6%',
            background: '#3b82f6',
            borderRadius: '2px',
          }} />
        </div>

        {/* Watermark */}
        <div style={{
          position: 'absolute', top: '12px', right: '12px',
          background: '#00000088',
          borderRadius: '4px', padding: '3px 8px',
          fontSize: '9px', color: '#ffffff88', fontWeight: '600',
        }}>
          AI 분석 결과 - 참고용
        </div>

        {/* Verdict overlay */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          opacity: playing && progress > 60 ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}>
          <div style={{
            fontSize: '48px', fontWeight: '900',
            background: 'linear-gradient(90deg, #ef4444, #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            textShadow: 'none',
          }}>7:3</div>
          <div style={{ color: '#fca5a5', fontSize: '11px', fontWeight: '700' }}>과실비율</div>
        </div>

        {/* Subtitle */}
        <div style={{
          position: 'relative', zIndex: 2,
          padding: '12px',
          background: 'linear-gradient(0deg, #000000cc, transparent)',
        }}>
          {playing && (
            <div style={{
              background: '#000000bb',
              borderRadius: '6px',
              padding: '8px 10px',
              marginBottom: '8px',
              animation: 'fadeIn 0.3s ease',
            }}>
              <p style={{ color: '#fff', fontSize: '11px', lineHeight: '1.5', textAlign: 'center' }}>
                {lines[currentLine]}
              </p>
            </div>
          )}

          {/* Progress bar */}
          <div style={{ background: '#ffffff33', borderRadius: '100px', height: '3px', marginBottom: '10px' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: '#fff', borderRadius: '100px',
              transition: 'width 0.1s linear',
            }} />
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <button
              onClick={togglePlay}
              style={{
                width: '40px', height: '40px',
                background: 'rgba(255,255,255,0.2)',
                border: '2px solid rgba(255,255,255,0.5)',
                borderRadius: '50%',
                color: '#fff', fontSize: '16px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              {playing ? '⏸' : '▶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultPage({ file, onReset }) {
  const [activeTab, setActiveTab] = useState('fault');
  const [liveSubtitle, setLiveSubtitle] = useState('');

  // file prop이 File 객체면 Object URL 생성, 없으면 fallback
  const videoSrc = React.useMemo(() => {
    if (file instanceof File) return URL.createObjectURL(file);
    return '/bb_h264.mp4'; // 개발용 fallback
  }, [file]);

  // 컴포넌트 언마운트 시 Object URL 해제 (메모리 누수 방지)
  React.useEffect(() => {
    return () => {
      if (file instanceof File) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc]);

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
            <p style={{ color: '#475569', fontSize: '12px' }}>ID: {MOCK_RESULT.analysisId}</p>
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
            <p style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '700' }}>{MOCK_RESULT.accidentType}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>AI 판결</p>
            <div style={{
              fontSize: '40px', fontWeight: '900',
              background: 'linear-gradient(90deg, #ef4444, #f97316)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{MOCK_RESULT.verdict}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>관련 법규</p>
            {MOCK_RESULT.laws.map(l => (
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
                  {MOCK_RESULT.precedent}
                </p>
              </div>
              <FaultChart a={MOCK_RESULT.fault.a} b={MOCK_RESULT.fault.b} />
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
                {MOCK_RESULT.timeline.map((item, i) => (
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
                { label: '도입부', color: '#3b82f6', text: MOCK_RESULT.script.intro, time: '00:00 ~ 00:10' },
                { label: '분석부', color: '#f59e0b', text: MOCK_RESULT.script.analysis, time: '00:10 ~ 00:45' },
                { label: '결론부', color: '#ef4444', text: MOCK_RESULT.script.conclusion, time: '00:45 ~ 01:00' },
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
                    titleLine1={MOCK_RESULT.accidentType.split(' ')[0]}
                    titleLine2={MOCK_RESULT.accidentType.split(' ').slice(1).join(' ') || '사고 분석'}
                    subtitle={liveSubtitle || MOCK_RESULT.script.conclusion}
                    subtitleLabel="AI 판결"
                    scale={0.28}
                    style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 0 24px rgba(0,194,255,.25)' }}
                    videoContent={
                      <VideoEngine
                        src={videoSrc}
                        script={MUNCHEOL_SCRIPT}
                        showSubtitle={false}
                        onSubtitleChange={setLiveSubtitle}
                        style={{ width: '100%', height: '100%' }}
                      />
                    }
                    personVideo={window.__HANMUNCHEOL_VIDEO_URL || null}
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
