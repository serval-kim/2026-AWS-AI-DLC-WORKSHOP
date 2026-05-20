import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FONT      = "'DungGeunMo', sans-serif";
const FONT_MONO = "'DungGeunMo', monospace";

// Monochrome tokens
const BG_PANEL  = 'rgba(12, 12, 16, 0.72)';
const LINE_DIM  = 'rgba(255, 255, 255, 0.08)';
const LINE_MID  = 'rgba(255, 255, 255, 0.16)';
const LINE_HI   = 'rgba(255, 255, 255, 0.4)';
const TXT_HI    = '#fafafc';
const TXT_MID   = '#c8cad0';
const TXT_DIM   = '#8b8e96';
const TXT_VDIM  = '#54565c';

// Spring settings
const SPRING_SOFT  = { type: 'spring', stiffness: 280, damping: 32, mass: 0.8 };
const EASE_OUT     = { duration: 0.45, ease: [0.22, 1, 0.36, 1] };

// ─── Icons ────────────────────────────────────────────────────────────────────
function UploadIcon({ size = 36, color = LINE_HI }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <path d="M18 25V11" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 17L18 11L24 17" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 26V29H28V26" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BlackboxIcon({ size = 14, color = TXT_MID }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="5" width="12" height="10" rx="1" stroke={color} strokeWidth="1" />
      <path d="M14 9L18 7V13L14 11" stroke={color} strokeWidth="1" strokeLinejoin="round" />
      <circle cx="8" cy="10" r="2" stroke={color} strokeWidth="1" />
    </svg>
  );
}

// ─── Detection box (analyzing screen) ────────────────────────────────────────
function DetectionBox({ box }) {
  const { x, y, w, h, label } = box;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'absolute',
        left: `${x}%`, top: `${y}%`,
        width: `${w}%`, height: `${h}%`,
        border: `1px solid ${LINE_HI}`,
        pointerEvents: 'none',
      }}
    >
      {[
        { top: -1, left: -1, borderTop: `1.5px solid ${TXT_HI}`, borderLeft: `1.5px solid ${TXT_HI}`, width: 6, height: 6 },
        { top: -1, right: -1, borderTop: `1.5px solid ${TXT_HI}`, borderRight: `1.5px solid ${TXT_HI}`, width: 6, height: 6 },
        { bottom: -1, left: -1, borderBottom: `1.5px solid ${TXT_HI}`, borderLeft: `1.5px solid ${TXT_HI}`, width: 6, height: 6 },
        { bottom: -1, right: -1, borderBottom: `1.5px solid ${TXT_HI}`, borderRight: `1.5px solid ${TXT_HI}`, width: 6, height: 6 },
      ].map((s, i) => <div key={i} style={{ position: 'absolute', ...s }} />)}
      <div style={{
        position: 'absolute', top: -16, left: 0,
        background: 'rgba(0,0,0,0.7)',
        border: `1px solid ${LINE_MID}`,
        color: TXT_HI,
        fontSize: 8, fontWeight: 500,
        padding: '1px 5px',
        letterSpacing: '0.12em',
        whiteSpace: 'nowrap',
        fontFamily: FONT_MONO,
      }}>{label}</div>
    </motion.div>
  );
}

// ─── Analyzing screen ─────────────────────────────────────────────────────────
function AnalyzingScreen({ file, onComplete }) {
  const videoUrl = useRef(URL.createObjectURL(file));
  const [boxes, setBoxes] = useState([]);
  const [scanY, setScanY] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [posterUrl, setPosterUrl] = useState(null);
  const videoRef = useRef();

  // Capture first frame as poster fallback
  useEffect(() => {
    const video = document.createElement('video');
    video.src = videoUrl.current;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.currentTime = 0.5; // seek to 0.5s for a meaningful frame
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPosterUrl(canvas.toDataURL('image/jpeg', 0.8));
      } catch { /* cross-origin or other error — ignore */ }
    }, { once: true });
    video.load();
  }, []);

  // Try to play video on mount
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => { /* autoplay blocked — poster will show */ });
    }
  }, []);

  const LABELS = ['VEHICLE_A', 'VEHICLE_B', 'PEDESTRIAN', 'LANE_L', 'LANE_R', 'SIGNAL', 'TRAJECTORY'];

  useEffect(() => {
    const iv = setInterval(() => {
      const newBox = {
        id: Date.now() + Math.random(),
        x: 5 + Math.random() * 60,
        y: 10 + Math.random() * 60,
        w: 8 + Math.random() * 22,
        h: 6 + Math.random() * 18,
        label: LABELS[Math.floor(Math.random() * LABELS.length)],
      };
      setBoxes(prev => [...prev.slice(-7), newBox]);
      setTimeout(() => {
        setBoxes(prev => prev.filter(b => b.id !== newBox.id));
      }, 1800 + Math.random() * 800);
    }, 320);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setScanY(y => (y + 0.6) % 100), 16);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(e => {
        const next = e + 0.1;
        if (next >= 6) {
          clearInterval(iv);
          // Defer to next tick to avoid setState-during-render
          setTimeout(() => onComplete(), 0);
          return 6;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [onComplete]);

  useEffect(() => {
    const url = videoUrl.current;
    return () => URL.revokeObjectURL(url);
  }, []);

  const progress = Math.min(100, Math.round((elapsed / 6) * 100));
  const PIPELINE = ['UPLOADING', 'EXTRACTING', 'DETECTING', 'TRACKING', 'ANALYZING', 'COMPOSING'];
  const activeStep = Math.min(PIPELINE.length - 1, Math.floor((elapsed / 6) * PIPELINE.length));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={EASE_OUT}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: '#000',
        fontFamily: FONT,
      }}
    >
      <motion.video
        ref={videoRef}
        initial={{ scale: 1.05, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        src={videoUrl.current}
        poster={posterUrl || undefined}
        autoPlay loop muted playsInline
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
        }}
      />

      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.65) 100%)',
      }} />

      {/* Scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0,
        top: `${scanY}%`, height: 1,
        background: `linear-gradient(90deg, transparent, ${LINE_HI}, transparent)`,
        pointerEvents: 'none',
      }} />

      <AnimatePresence>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {boxes.map(box => <DetectionBox key={box.id} box={box} />)}
        </div>
      </AnimatePresence>

      {/* HUD corners */}
      {[
        { top: 16, left: 16, borderTop: `1px solid ${LINE_HI}`, borderLeft: `1px solid ${LINE_HI}` },
        { top: 16, right: 16, borderTop: `1px solid ${LINE_HI}`, borderRight: `1px solid ${LINE_HI}` },
        { bottom: 16, left: 16, borderBottom: `1px solid ${LINE_HI}`, borderLeft: `1px solid ${LINE_HI}` },
        { bottom: 16, right: 16, borderBottom: `1px solid ${LINE_HI}`, borderRight: `1px solid ${LINE_HI}` },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', width: 22, height: 22, ...s, pointerEvents: 'none' }} />
      ))}

      {/* Top REC indicator */}
      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...EASE_OUT, delay: 0.1 }}
        style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,0,0,0.6)',
          border: `1px solid ${LINE_MID}`,
          padding: '4px 12px',
        }}
      >
        <span style={{ width: 5, height: 5, background: '#c25a5a', borderRadius: '50%', animation: 'blink 1.2s infinite', display: 'block' }} />
        <span style={{ color: TXT_HI, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', fontFamily: FONT_MONO }}>
          AI · ANALYZING
        </span>
      </motion.div>

      {/* Pipeline — right */}
      <motion.div
        initial={{ x: 12, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...EASE_OUT, delay: 0.15 }}
        style={{
          position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', gap: 10,
          fontFamily: FONT_MONO,
        }}
      >
        {PIPELINE.map((step, i) => {
          const done = i < activeStep, active = i === activeStep;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: done || active ? 1 : 0.35,
              transition: 'opacity 0.4s',
            }}>
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: done ? TXT_HI : active ? TXT_HI : TXT_VDIM,
                boxShadow: active ? `0 0 6px ${TXT_HI}` : 'none',
              }} />
              <span style={{
                color: done ? TXT_MID : active ? TXT_HI : TXT_VDIM,
                fontSize: 9, fontWeight: 500,
                letterSpacing: '0.18em',
              }}>{step}</span>
            </div>
          );
        })}
      </motion.div>

      {/* Bottom — analyzing status + progress */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...EASE_OUT, delay: 0.2 }}
        style={{
          position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center', minWidth: 360,
        }}
      >
        <div style={{
          background: LINE_DIM, height: 1,
          marginBottom: 18, overflow: 'hidden',
        }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'linear' }}
            style={{ height: '100%', background: TXT_HI }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 8 }}>
          <div style={{
            width: 12, height: 12,
            border: `1px solid ${LINE_MID}`,
            borderTop: `1px solid ${TXT_HI}`,
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }} />
          <span style={{ color: TXT_HI, fontSize: 13, fontWeight: 400, letterSpacing: '0.04em' }}>
            {PIPELINE[activeStep]}
          </span>
          <span style={{ color: TXT_DIM, fontSize: 11, fontFamily: FONT_MONO, letterSpacing: '0.05em' }}>
            {String(progress).padStart(2, '0')}%
          </span>
        </div>

        <p style={{
          color: TXT_VDIM, fontSize: 9,
          letterSpacing: '0.18em', fontFamily: FONT_MONO,
          marginTop: 4,
        }}>
          BLACKBOX ANALYZER · 본 분석은 AI 추정치이며 법적 효력이 없습니다
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Upload card ──────────────────────────────────────────────────────────────
export default function BlackboxOverlay({ visible, onUpload }) {
  const [dragOver, setDragOver]   = useState(false);
  const [file, setFile]           = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError]         = useState('');
  const inputRef   = useRef();
  const previewUrl = useRef(null);

  const ALLOWED_EXT = /\.(mp4|avi|mov)$/i;
  const MAX_SIZE    = 500 * 1024 * 1024;

  function validateFile(f) {
    if (!ALLOWED_EXT.test(f.name)) return 'MP4, AVI, MOV 형식만 지원합니다';
    if (f.size > MAX_SIZE) return '파일 크기가 500MB를 초과합니다';
    return null;
  }

  function handleFile(f) {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError('');
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(f);
    setFile(f);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  const handleAnalysisComplete = useCallback(() => {
    onUpload(file);
  }, [file, onUpload]);

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

  if (!visible) return null;

  if (analyzing && file) {
    return <AnalyzingScreen file={file} onComplete={handleAnalysisComplete} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={EASE_OUT}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 10,
        fontFamily: FONT,
      }}
    >
      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.72) 100%)',
        pointerEvents: 'none',
      }} />

      {/* HUD corners */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[
          { top: 16, left: 16, borderTop: `1px solid ${LINE_HI}`, borderLeft: `1px solid ${LINE_HI}` },
          { top: 16, right: 16, borderTop: `1px solid ${LINE_HI}`, borderRight: `1px solid ${LINE_HI}` },
          { bottom: 16, left: 16, borderBottom: `1px solid ${LINE_HI}`, borderLeft: `1px solid ${LINE_HI}` },
          { bottom: 16, right: 16, borderBottom: `1px solid ${LINE_HI}`, borderRight: `1px solid ${LINE_HI}` },
        ].map((s, i) => <div key={i} style={{ position: 'absolute', width: 22, height: 22, ...s }} />)}


        <div style={{
          position: 'absolute', bottom: 22, left: 22,
          color: TXT_VDIM, fontSize: 9, fontFamily: FONT_MONO, letterSpacing: '0.1em',
        }}>
          {new Date().toLocaleString('ko-KR', { hour12: false })}
        </div>
        <div style={{
          position: 'absolute', bottom: 22, right: 22,
          color: TXT_VDIM, fontSize: 9, fontFamily: FONT_MONO, letterSpacing: '0.1em',
        }}>
          37.5665°N · 126.9780°E
        </div>
      </div>

      {/* Card */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={SPRING_SOFT}
        style={{
          position: 'relative', zIndex: 20,
          pointerEvents: 'all',
          width: '100%', maxWidth: 420,
          padding: '20px 16px 4px 16px',
          background: 'rgba(14, 14, 18, 0.85)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${LINE_DIM}`,
          borderRadius: 16,
        }}
      >
        {/* Title */}
        <h2 style={{
          textAlign: 'center',
          fontSize: 16, fontWeight: 600,
          color: TXT_HI,
          marginBottom: 20,
          letterSpacing: '0.02em',
        }}>
          블랙박스 영상을 업로드 해주세요
        </h2>

        {/* Drop zone */}
        <motion.div
          layout
          transition={SPRING_SOFT}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current.click()}
          style={{
            position: 'relative',
            background: dragOver ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${dragOver ? LINE_HI : LINE_DIM}`,
            borderRadius: 12,
            cursor: file ? 'default' : 'pointer',
            marginBottom: 16,
            height: file ? 320 : 200,
            overflow: 'hidden',
            transition: 'border-color 0.2s, background 0.2s',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".mp4,.avi,.mov"
            onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); }}
            style={{ display: 'none' }}
          />

          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={EASE_OUT}
                style={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12,
                }}
              >
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <UploadIcon size={32} color={dragOver ? TXT_HI : TXT_DIM} />
                </motion.div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{
                    color: dragOver ? TXT_HI : TXT_MID,
                    fontSize: 14, fontWeight: 500, marginBottom: 4,
                    transition: 'color 0.2s',
                  }}>
                    {dragOver ? '여기에 놓으세요' : 'Drop file here or browse'}
                  </p>
                  <p style={{ color: TXT_VDIM, fontSize: 12 }}>
                    MP4, AVI, MOV up to 500MB
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={EASE_OUT}
                style={{ width: '100%', height: '100%', position: 'relative' }}
              >
                <video
                  src={previewUrl.current}
                  autoPlay loop muted playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 11 }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* File info card — shown when file is attached */}
        <AnimatePresence>
          {file && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={EASE_OUT}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${LINE_DIM}`,
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              {/* Video icon */}
              <div style={{
                width: 36, height: 36,
                borderRadius: 8,
                background: 'rgba(200, 60, 60, 0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="4" width="12" height="12" rx="2" fill="rgba(200,60,60,0.8)" />
                  <path d="M14 8L18 6V14L14 12" fill="rgba(200,60,60,0.6)" />
                  <polygon points="7,7 7,13 12,10" fill="white" />
                </svg>
              </div>
              {/* File info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: TXT_HI, fontSize: 13, fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{file.name}</p>
                <p style={{ color: TXT_DIM, fontSize: 11 }}>{formatSize(file.size)}</p>
              </div>
              {/* Delete button */}
              <button
                onClick={() => { setFile(null); setError(''); }}
                style={{
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: 6,
                  color: TXT_DIM, display: 'flex',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = TXT_HI}
                onMouseLeave={e => e.currentTarget.style.color = TXT_DIM}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v4M8 7v4M10 7v4M4 4l.7 8.4a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4"
                    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={EASE_OUT}
              style={{
                background: 'rgba(194,90,90,0.06)',
                border: '1px solid rgba(194,90,90,0.25)',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 12,
                color: '#d18585',
                fontSize: 11,
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA — dark pill button like reference */}
        <AnimatePresence>
          {file && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={EASE_OUT}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setAnalyzing(true)}
              style={{
                width: '100%', padding: '14px 24px',
                background: TXT_HI,
                border: 'none',
                borderRadius: 100,
                color: '#0a0a0c',
                fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
                fontFamily: FONT,
                letterSpacing: '0.02em',
                fontWeight: 700,
                marginBottom: "12px",
              }}
            >
              분석하기
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
