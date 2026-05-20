import React, { useState, useRef, useEffect, useCallback } from 'react';

const FONT = "'Noto Sans KR', -apple-system, sans-serif";
const C_CYAN = '#00e5ff';
const C_DIM  = 'rgba(0,229,255,0.3)';

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function UploadIcon({ size = 44, color = C_DIM }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <path d="M22 30V14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 22L22 14L30 22" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 32V36H36V32" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ size = 36, color = C_CYAN }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="16" stroke={color} strokeWidth="1.5" />
      <path d="M11 18L16 23L25 13" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Detection box that floats and fades ──────────────────────────────────────
function DetectionBox({ box }) {
  const { x, y, w, h, label, color, opacity } = box;
  return (
    <div style={{
      position: 'absolute',
      left: `${x}%`, top: `${y}%`,
      width: `${w}%`, height: `${h}%`,
      border: `1.5px solid ${color}`,
      opacity,
      transition: 'opacity 0.3s ease',
      pointerEvents: 'none',
    }}>
      {/* Corner accents */}
      {[
        { top: -1, left: -1, borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}`, width: 8, height: 8 },
        { top: -1, right: -1, borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}`, width: 8, height: 8 },
        { bottom: -1, left: -1, borderBottom: `2px solid ${color}`, borderLeft: `2px solid ${color}`, width: 8, height: 8 },
        { bottom: -1, right: -1, borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}`, width: 8, height: 8 },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', ...s }} />
      ))}
      {/* Label */}
      <div style={{
        position: 'absolute', top: -18, left: 0,
        background: color,
        color: '#000',
        fontSize: 9, fontWeight: 700,
        padding: '1px 5px',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
        fontFamily: 'monospace',
      }}>
        {label}
      </div>
    </div>
  );
}

// ─── Analyzing overlay (full-screen video + detection boxes) ─────────────────
function AnalyzingScreen({ file, onComplete }) {
  const videoRef = useRef();
  const videoUrl = useRef(URL.createObjectURL(file));
  const [boxes, setBoxes] = useState([]);
  const [scanY, setScanY] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const LABELS = [
    { text: 'VEHICLE_A', color: '#00e5ff' },
    { text: 'VEHICLE_B', color: '#ff6600' },
    { text: 'PEDESTRIAN', color: '#ffffff' },
    { text: 'LANE_L', color: '#00ff88' },
    { text: 'LANE_R', color: '#00ff88' },
    { text: 'SIGNAL', color: '#ffcc00' },
    { text: 'TRAJECTORY', color: '#ff00aa' },
  ];

  // Spawn random detection boxes
  useEffect(() => {
    const iv = setInterval(() => {
      const label = LABELS[Math.floor(Math.random() * LABELS.length)];
      const newBox = {
        id: Date.now() + Math.random(),
        x: 5 + Math.random() * 60,
        y: 10 + Math.random() * 60,
        w: 8 + Math.random() * 22,
        h: 6 + Math.random() * 18,
        label: label.text,
        color: label.color,
        opacity: 0,
      };
      setBoxes(prev => [...prev.slice(-8), newBox]);
      // Fade in
      setTimeout(() => {
        setBoxes(prev => prev.map(b => b.id === newBox.id ? { ...b, opacity: 1 } : b));
      }, 50);
      // Fade out
      setTimeout(() => {
        setBoxes(prev => prev.map(b => b.id === newBox.id ? { ...b, opacity: 0 } : b));
      }, 1200 + Math.random() * 800);
      // Remove
      setTimeout(() => {
        setBoxes(prev => prev.filter(b => b.id !== newBox.id));
      }, 2200 + Math.random() * 800);
    }, 320);
    return () => clearInterval(iv);
  }, []);

  // Scan line
  useEffect(() => {
    const iv = setInterval(() => {
      setScanY(y => (y + 0.8) % 100);
    }, 16);
    return () => clearInterval(iv);
  }, []);

  // Elapsed timer → trigger onComplete after ~6s
  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(e => {
        if (e >= 6) { clearInterval(iv); onComplete(); }
        return e + 0.1;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [onComplete]);

  // Cleanup blob URL
  useEffect(() => {
    const url = videoUrl.current;
    return () => URL.revokeObjectURL(url);
  }, []);

  const progress = Math.min(100, Math.round((elapsed / 6) * 100));

  const PIPELINE = ['영상 업로드', '프레임 추출', '객체 탐지', '궤적 분석', '과실 판단', '릴스 생성'];
  const activeStep = Math.min(PIPELINE.length - 1, Math.floor((elapsed / 6) * PIPELINE.length));

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'transparent',
      fontFamily: FONT,
      animation: 'fadeIn 0.5s ease',
    }}>
      {/* Full-screen video */}
      <video
        ref={videoRef}
        src={videoUrl.current}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: 0.75,
        }}
      />

      {/* Dark overlay — lighter so video is visible */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.5) 100%)',
      }} />

      {/* Scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0,
        top: `${scanY}%`, height: 2,
        background: `linear-gradient(90deg, transparent, ${C_CYAN}88, transparent)`,
        pointerEvents: 'none',
      }} />

      {/* Detection boxes */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {boxes.map(box => <DetectionBox key={box.id} box={box} />)}
      </div>

      {/* HUD corners */}
      {[
        { top: 16, left: 16, borderTop: `1.5px solid ${C_CYAN}`, borderLeft: `1.5px solid ${C_CYAN}` },
        { top: 16, right: 16, borderTop: `1.5px solid ${C_CYAN}`, borderRight: `1.5px solid ${C_CYAN}` },
        { bottom: 16, left: 16, borderBottom: `1.5px solid ${C_CYAN}`, borderLeft: `1.5px solid ${C_CYAN}` },
        { bottom: 16, right: 16, borderBottom: `1.5px solid ${C_CYAN}`, borderRight: `1.5px solid ${C_CYAN}` },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', width: 24, height: 24, ...s, pointerEvents: 'none' }} />
      ))}

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(0,0,0,0.7)', borderRadius: 4,
        padding: '4px 14px', border: `1px solid ${C_DIM}`,
      }}>
        <span style={{ width: 6, height: 6, background: '#ff2200', borderRadius: '50%', animation: 'blink 1s infinite', display: 'block' }} />
        <span style={{ color: C_CYAN, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em' }}>AI ANALYZING</span>
      </div>

      {/* Pipeline steps — right side */}
      <div style={{
        position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {PIPELINE.map((step, i) => {
          const done   = i < activeStep;
          const active = i === activeStep;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: done || active ? 1 : 0.3,
              transition: 'opacity 0.4s',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: done ? C_CYAN : active ? '#ffffff' : 'rgba(255,255,255,0.3)',
                boxShadow: active ? `0 0 8px ${C_CYAN}` : 'none',
                flexShrink: 0,
              }} />
              <span style={{
                color: done ? C_CYAN : active ? '#ffffff' : 'rgba(255,255,255,0.4)',
                fontSize: 10, fontWeight: active ? 700 : 400,
                letterSpacing: '0.06em',
                fontFamily: 'monospace',
              }}>{step}</span>
              {active && (
                <span style={{ color: C_CYAN, fontSize: 9, animation: 'blink 0.8s infinite' }}>●</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom center — analyzing text + progress */}
      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', minWidth: 320,
      }}>
        {/* Progress bar */}
        <div style={{
          background: 'rgba(0,229,255,0.1)', borderRadius: 100,
          height: 2, marginBottom: 16, overflow: 'hidden',
          border: `1px solid ${C_DIM}`,
        }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: C_CYAN,
            borderRadius: 100,
            transition: 'width 0.3s ease',
            boxShadow: `0 0 10px ${C_CYAN}`,
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          {/* Spinner */}
          <div style={{
            width: 14, height: 14,
            border: `1.5px solid ${C_DIM}`,
            borderTop: `1.5px solid ${C_CYAN}`,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{
            color: '#ffffff',
            fontSize: 15, fontWeight: 600,
            letterSpacing: '0.04em',
          }}>
            {PIPELINE[activeStep]} 중...
          </span>
          <span style={{
            color: C_CYAN, fontSize: 13,
            fontFamily: 'monospace', fontWeight: 700,
          }}>
            {progress}%
          </span>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '0.1em' }}>
          AI BLACKBOX ANALYZER · 본 분석은 AI 추정치이며 법적 효력이 없습니다
        </p>
      </div>
    </div>
  );
}

// ─── Upload card (shown over 3D scene) ───────────────────────────────────────
export default function BlackboxOverlay({ visible, onUpload }) {
  const [dragOver, setDragOver]   = useState(false);
  const [file, setFile]           = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError]         = useState('');
  const inputRef  = useRef();
  const videoRef  = useRef();
  const previewUrl = useRef(null);

  const ALLOWED_EXT = /\.(mp4|avi|mov)$/i;
  const MAX_SIZE    = 500 * 1024 * 1024;

  function validateFile(f) {
    if (!ALLOWED_EXT.test(f.name)) return 'MP4, AVI, MOV 형식만 지원합니다.';
    if (f.size > MAX_SIZE) return '파일 크기가 500MB를 초과합니다.';
    return null;
  }

  function handleFile(f) {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError('');
    // Revoke previous preview
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(f);
    setFile(f);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function startAnalysis() {
    if (!file) return;
    setAnalyzing(true);
  }

  const handleAnalysisComplete = useCallback(() => {
    onUpload(file);
  }, [file, onUpload]);

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Cleanup
  useEffect(() => {
    return () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); };
  }, []);

  if (!visible) return null;

  // ── Analyzing full-screen ──
  if (analyzing && file) {
    return <AnalyzingScreen file={file} onComplete={handleAnalysisComplete} />;
  }

  // ── Upload card ──
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 10,
      fontFamily: FONT,
    }}>
      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.88) 100%)',
        pointerEvents: 'none',
      }} />

      {/* HUD corners */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[
          { top: 14, left: 14, borderTop: `1.5px solid ${C_CYAN}`, borderLeft: `1.5px solid ${C_CYAN}` },
          { top: 14, right: 14, borderTop: `1.5px solid ${C_CYAN}`, borderRight: `1.5px solid ${C_CYAN}` },
          { bottom: 14, left: 14, borderBottom: `1.5px solid ${C_CYAN}`, borderLeft: `1.5px solid ${C_CYAN}` },
          { bottom: 14, right: 14, borderBottom: `1.5px solid ${C_CYAN}`, borderRight: `1.5px solid ${C_CYAN}` },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...s }} />
        ))}
        {/* REC */}
        <div style={{
          position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.7)', borderRadius: 3, padding: '3px 10px',
          border: `1px solid ${C_DIM}`,
        }}>
          <span style={{ width: 6, height: 6, background: '#ff2200', borderRadius: '50%', animation: 'blink 1s infinite', display: 'block' }} />
          <span style={{ color: C_CYAN, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em' }}>REC</span>
        </div>
        <div style={{ position: 'absolute', bottom: 18, left: 18, color: C_DIM, fontSize: 10, fontFamily: 'monospace' }}>
          {new Date().toLocaleString('ko-KR', { hour12: false })}
        </div>
        <div style={{ position: 'absolute', bottom: 18, right: 18, color: C_DIM, fontSize: 10, fontFamily: 'monospace' }}>
          37.5665°N 126.9780°E
        </div>
      </div>

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 20,
        pointerEvents: 'all',
        width: '100%', maxWidth: 480,
        padding: '0 24px',
        animation: 'fadeIn 0.7s ease',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            border: `1px solid ${C_DIM}`, borderRadius: 100,
            padding: '4px 14px', marginBottom: 12,
            background: 'rgba(0,229,255,0.04)',
          }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
              <rect x="1" y="4" width="14" height="12" rx="1.5" stroke={C_CYAN} strokeWidth="1.2" />
              <path d="M15 8L19 6V14L15 12" stroke={C_CYAN} strokeWidth="1.2" strokeLinejoin="round" />
              <circle cx="8" cy="10" r="2.5" stroke={C_CYAN} strokeWidth="1.2" />
            </svg>
            <span style={{ color: C_CYAN, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em' }}>
              BLACKBOX AI ANALYZER
            </span>
          </div>
          <h1 style={{
            fontSize: 'clamp(17px, 3vw, 26px)', fontWeight: 600,
            color: '#ffffff', marginBottom: 4, lineHeight: 1.3,
          }}>
            블랙박스 영상을 업로드하세요
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
            AI가 사고를 분석하고 한문철 스타일 릴스를 생성합니다
          </p>
        </div>

        {/* Drop zone / Video preview */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current.click()}
          style={{
            position: 'relative',
            background: dragOver ? 'rgba(0,229,255,0.07)' : 'rgba(0,0,0,0.65)',
            border: `1.5px dashed ${dragOver ? C_CYAN : file ? 'rgba(0,229,255,0.5)' : C_DIM}`,
            borderRadius: 12,
            overflow: 'hidden',
            cursor: file ? 'default' : 'pointer',
            transition: 'all 0.25s ease',
            backdropFilter: 'blur(16px)',
            marginBottom: 10,
            // Fixed height: taller when video is loaded
            height: file ? 200 : 140,
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".mp4,.avi,.mov"
            onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); }}
            style={{ display: 'none' }}
          />

          {!file ? (
            /* Empty state */
            <div style={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <div style={{ animation: 'float 3s ease-in-out infinite' }}>
                <UploadIcon size={40} color={dragOver ? C_CYAN : C_DIM} />
              </div>
              <p style={{ color: dragOver ? C_CYAN : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500 }}>
                {dragOver ? '여기에 놓으세요' : '영상 파일을 드래그하거나 클릭'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, letterSpacing: '0.05em' }}>
                MP4 · AVI · MOV · MAX 500MB
              </p>
            </div>
          ) : (
            /* Video preview */
            <>
              <video
                ref={videoRef}
                src={previewUrl.current}
                autoPlay
                loop
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {/* Overlay info */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', bottom: 8, left: 10, right: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ color: C_CYAN, fontSize: 10, fontWeight: 600 }}>{file.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{formatSize(file.size)}</span>
              </div>
              {/* Change file button */}
              <button
                onClick={e => { e.stopPropagation(); setFile(null); setError(''); }}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(0,0,0,0.7)', border: `1px solid ${C_DIM}`,
                  borderRadius: 4, color: 'rgba(255,255,255,0.5)',
                  padding: '3px 8px', fontSize: 10, cursor: 'pointer', fontFamily: FONT,
                }}
              >변경</button>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(255,34,0,0.08)', border: '1px solid rgba(255,34,0,0.3)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 8,
            color: '#ff6644', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* CTA */}
        {file && (
          <button
            onClick={startAnalysis}
            style={{
              width: '100%', padding: '12px',
              background: 'transparent',
              border: `1.5px solid ${C_CYAN}`,
              borderRadius: 8,
              color: C_CYAN,
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT,
              letterSpacing: '0.12em',
              boxShadow: `0 0 18px rgba(0,229,255,0.18)`,
              animation: 'fadeIn 0.3s ease',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0,229,255,0.08)';
              e.currentTarget.style.boxShadow = `0 0 28px rgba(0,229,255,0.3)`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.boxShadow = `0 0 18px rgba(0,229,255,0.18)`;
            }}
          >
            분석하기 →
          </button>
        )}
      </div>
    </div>
  );
}
