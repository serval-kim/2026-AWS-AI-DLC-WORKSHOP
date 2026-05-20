import React, { useState, useRef } from 'react';

export default function UploadPage({ onUpload }) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef();

  const ALLOWED = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo'];
  const MAX_SIZE = 500 * 1024 * 1024;

  function validateFile(f) {
    if (!ALLOWED.includes(f.type) && !f.name.match(/\.(mp4|avi|mov)$/i)) {
      return 'MP4, AVI, MOV 형식만 지원합니다.';
    }
    if (f.size > MAX_SIZE) {
      return '파일 크기가 500MB를 초과합니다.';
    }
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

  function handleChange(e) {
    const f = e.target.files[0];
    if (f) handleFile(f);
  }

  function startUpload() {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    // 업로드 진행률 시뮬레이션
    let prog = 0;
    const interval = setInterval(() => {
      prog += Math.random() * 12 + 3;
      if (prog >= 100) {
        prog = 100;
        clearInterval(interval);
        setTimeout(() => onUpload(file), 400);
      }
      setUploadProgress(Math.min(Math.round(prog), 100));
    }, 150);
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e1a 0%, #0f1629 50%, #0a0e1a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px', animation: 'fadeIn 0.6s ease' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          background: 'linear-gradient(90deg, #3b82f611, #06b6d411)',
          border: '1px solid #3b82f633',
          borderRadius: '100px',
          padding: '6px 16px',
          marginBottom: '20px',
          fontSize: '12px', color: '#06b6d4', fontWeight: '600',
          letterSpacing: '0.1em',
        }}>
          <span style={{ width: '6px', height: '6px', background: '#06b6d4', borderRadius: '50%', animation: 'blink 1.5s infinite' }} />
          AI BLACKBOX ANALYZER
        </div>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 48px)',
          fontWeight: '900',
          lineHeight: '1.2',
          marginBottom: '12px',
        }}>
          <span style={{
            background: 'linear-gradient(90deg, #f1f5f9, #94a3b8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>블랙박스 사고 분석</span>
          <br />
          <span style={{
            background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>& 한문철 릴스 생성기</span>
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '480px', margin: '0 auto' }}>
          블랙박스 영상을 업로드하면 AI가 사고를 분석하고<br />
          한문철 변호사 스타일의 숏폼 릴스를 자동 생성합니다
        </p>
      </div>

      {/* Upload Card */}
      <div style={{
        width: '100%', maxWidth: '600px',
        animation: 'fadeIn 0.7s ease',
      }}>
        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && !uploading && inputRef.current.click()}
          style={{
            background: dragOver
              ? 'linear-gradient(135deg, #3b82f622, #06b6d422)'
              : file ? 'linear-gradient(135deg, #10b98111, #06b6d411)' : '#141c2e',
            border: `2px dashed ${dragOver ? '#3b82f6' : file ? '#10b981' : '#2d4a7a'}`,
            borderRadius: '20px',
            padding: '48px 32px',
            textAlign: 'center',
            cursor: file || uploading ? 'default' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: dragOver ? '0 0 40px rgba(59,130,246,0.2)' : 'none',
            marginBottom: '16px',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".mp4,.avi,.mov,video/mp4,video/avi,video/quicktime"
            onChange={handleChange}
            style={{ display: 'none' }}
          />

          {!file ? (
            <>
              <div style={{
                width: '80px', height: '80px',
                background: 'linear-gradient(135deg, #3b82f622, #06b6d422)',
                border: '2px solid #3b82f644',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '36px',
                animation: 'float 3s ease-in-out infinite',
              }}>
                🎬
              </div>
              <p style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                {dragOver ? '여기에 놓으세요!' : '영상 파일을 드래그하거나 클릭하세요'}
              </p>
              <p style={{ color: '#475569', fontSize: '13px' }}>
                MP4, AVI, MOV · 최대 500MB
              </p>
            </>
          ) : (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <p style={{ color: '#10b981', fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>
                {file.name}
              </p>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
                {formatSize(file.size)}
              </p>
              {!uploading && (
                <button
                  onClick={e => { e.stopPropagation(); setFile(null); setError(''); }}
                  style={{
                    background: 'transparent',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    padding: '6px 14px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  다른 파일 선택
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#ef444411',
            border: '1px solid #ef444433',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#fca5a5',
            fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div style={{
            background: '#141c2e',
            border: '1px solid #1e2d4a',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>S3 업로드 중...</span>
              <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '700' }}>{uploadProgress}%</span>
            </div>
            <div style={{ background: '#0a0e1a', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                borderRadius: '100px',
                transition: 'width 0.15s ease',
                backgroundSize: '200% 100%',
                animation: 'progress-shimmer 1.5s linear infinite',
              }} />
            </div>
          </div>
        )}

        {/* CTA Button */}
        {file && !uploading && (
          <button
            onClick={startUpload}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              border: 'none',
              borderRadius: '14px',
              color: 'white',
              fontSize: '17px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
              boxShadow: '0 4px 24px rgba(59,130,246,0.4)',
              animation: 'fadeIn 0.3s ease',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 32px rgba(59,130,246,0.5)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 24px rgba(59,130,246,0.4)'; }}
          >
            🚀 사고 분석 시작
          </button>
        )}
      </div>
    </div>
  );
}
