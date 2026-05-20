import React, { useState, useRef } from 'react';

/**
 * HTML overlay rendered on top of the 3D canvas when camera is in interior/blackbox view.
 * Shows the blackbox camera UI + upload button.
 */
export default function BlackboxOverlay({ visible, onUpload }) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef();

  const ALLOWED_EXT = /\.(mp4|avi|mov)$/i;
  const MAX_SIZE = 500 * 1024 * 1024;

  function validateFile(f) {
    if (!ALLOWED_EXT.test(f.name)) return 'MP4, AVI, MOV 형식만 지원합니다.';
    if (f.size > MAX_SIZE) return '파일 크기가 500MB를 초과합니다.';
    return null;
  }

  function handleFile(f) {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError('');
    setFile(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function startUpload() {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    let prog = 0;
    const iv = setInterval(() => {
      prog += Math.random() * 12 + 3;
      if (prog >= 100) {
        prog = 100;
        clearInterval(iv);
        setTimeout(() => onUpload(file), 400);
      }
      setUploadProgress(Math.min(Math.round(prog), 100));
    }, 150);
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      {/* Blackbox camera frame overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Blackbox HUD corners */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Top-left */}
        <div style={{ position: 'absolute', top: 16, left: 16, width: 32, height: 32, borderTop: '2px solid #06b6d4', borderLeft: '2px solid #06b6d4' }} />
        {/* Top-right */}
        <div style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderTop: '2px solid #06b6d4', borderRight: '2px solid #06b6d4' }} />
        {/* Bottom-left */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, width: 32, height: 32, borderBottom: '2px solid #06b6d4', borderLeft: '2px solid #06b6d4' }} />
        {/* Bottom-right */}
        <div style={{ position: 'absolute', bottom: 16, right: 16, width: 32, height: 32, borderBottom: '2px solid #06b6d4', borderRight: '2px solid #06b6d4' }} />

        {/* REC indicator */}
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '3px 10px',
        }}>
          <span style={{ width: 7, height: 7, background: '#ef4444', borderRadius: '50%', animation: 'blink 1s infinite', display: 'block' }} />
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>REC</span>
        </div>

        {/* Timestamp */}
        <div style={{
          position: 'absolute', bottom: 20, left: 20,
          color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'monospace',
        }}>
          {new Date().toLocaleString('ko-KR', { hour12: false })}
        </div>

        {/* Speed mock */}
        <div style={{
          position: 'absolute', bottom: 20, right: 20,
          color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'monospace',
        }}>
          GPS 37.5665°N 126.9780°E
        </div>
      </div>

      {/* ── Upload Card (center) ── */}
      <div style={{
        position: 'relative', zIndex: 20,
        pointerEvents: 'all',
        width: '100%', maxWidth: 480,
        padding: '0 24px',
        animation: 'fadeIn 0.6s ease',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)',
            borderRadius: 100, padding: '5px 14px', marginBottom: 12,
            fontSize: 11, color: '#06b6d4', fontWeight: 700, letterSpacing: '0.12em',
          }}>
            <span style={{ width: 6, height: 6, background: '#06b6d4', borderRadius: '50%', animation: 'blink 1.5s infinite', display: 'block' }} />
            BLACKBOX AI ANALYZER
          </div>
          <h1 style={{
            fontSize: 'clamp(20px, 4vw, 32px)', fontWeight: 900, lineHeight: 1.2,
            color: '#f1f5f9', marginBottom: 6,
            textShadow: '0 0 30px rgba(59,130,246,0.5)',
          }}>
            블랙박스 영상을 업로드하세요
          </h1>
          <p style={{ color: 'rgba(148,163,184,0.9)', fontSize: 13 }}>
            AI가 사고를 분석하고 한문철 스타일 릴스를 생성합니다
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && !uploading && inputRef.current.click()}
          style={{
            background: dragOver
              ? 'rgba(59,130,246,0.18)'
              : file
                ? 'rgba(16,185,129,0.1)'
                : 'rgba(10,14,26,0.75)',
            border: `2px dashed ${dragOver ? '#3b82f6' : file ? '#10b981' : 'rgba(45,74,122,0.8)'}`,
            borderRadius: 16,
            padding: '32px 24px',
            textAlign: 'center',
            cursor: file || uploading ? 'default' : 'pointer',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(12px)',
            boxShadow: dragOver ? '0 0 40px rgba(59,130,246,0.3)' : '0 8px 32px rgba(0,0,0,0.5)',
            marginBottom: 12,
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
            <>
              <div style={{
                fontSize: 40, marginBottom: 12,
                animation: 'float 3s ease-in-out infinite',
                display: 'block',
              }}>🎬</div>
              <p style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                {dragOver ? '여기에 놓으세요!' : '영상 파일을 드래그하거나 클릭'}
              </p>
              <p style={{ color: 'rgba(71,85,105,0.9)', fontSize: 12 }}>MP4 · AVI · MOV · 최대 500MB</p>
            </>
          ) : (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <p style={{ color: '#10b981', fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{file.name}</p>
              <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 12, marginBottom: 12 }}>{formatSize(file.size)}</p>
              {!uploading && (
                <button
                  onClick={e => { e.stopPropagation(); setFile(null); setError(''); }}
                  style={{
                    background: 'transparent', border: '1px solid rgba(71,85,105,0.6)',
                    borderRadius: 8, color: 'rgba(148,163,184,0.8)',
                    padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >다른 파일 선택</button>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 10,
            color: '#fca5a5', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div style={{
            background: 'rgba(20,28,46,0.85)', border: '1px solid rgba(30,45,74,0.8)',
            borderRadius: 10, padding: '14px 16px', marginBottom: 10,
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: 'rgba(148,163,184,0.9)', fontSize: 12 }}>S3 업로드 중...</span>
              <span style={{ color: '#3b82f6', fontSize: 12, fontWeight: 700 }}>{uploadProgress}%</span>
            </div>
            <div style={{ background: 'rgba(10,14,26,0.8)', borderRadius: 100, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${uploadProgress}%`,
                background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                borderRadius: 100, transition: 'width 0.15s ease',
              }} />
            </div>
          </div>
        )}

        {/* CTA */}
        {file && !uploading && (
          <button
            onClick={startUpload}
            style={{
              width: '100%', padding: '14px',
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              border: 'none', borderRadius: 12,
              color: 'white', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 24px rgba(59,130,246,0.5)',
              animation: 'fadeIn 0.3s ease',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 32px rgba(59,130,246,0.6)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 24px rgba(59,130,246,0.5)'; }}
          >
            🚀 사고 분석 시작
          </button>
        )}
      </div>
    </div>
  );
}
