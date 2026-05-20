import React from 'react';

export default function DisclaimerModal({ onAccept }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0f1629 0%, #141c2e 100%)',
        border: '1px solid #2d4a7a',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 0 60px rgba(59,130,246,0.2)',
        animation: 'fadeIn 0.4s ease',
      }}>
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '72px', height: '72px',
            background: 'linear-gradient(135deg, #f59e0b22, #ef444422)',
            border: '2px solid #f59e0b',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '32px',
          }}>⚠️</div>
          <h2 style={{
            fontSize: '22px', fontWeight: '700',
            background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>법적 면책 고지</h2>
        </div>

        {/* Content */}
        <div style={{
          background: '#0a0e1a',
          border: '1px solid #1e2d4a',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <p style={{ color: '#f1f5f9', fontSize: '14px', lineHeight: '1.8', marginBottom: '12px' }}>
            본 서비스는 <strong style={{ color: '#f59e0b' }}>AI 기반 블랙박스 사고 분석 시뮬레이터</strong>입니다.
          </p>
          <ul style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '2', paddingLeft: '16px' }}>
            <li>분석 결과는 <strong style={{ color: '#ef4444' }}>AI 추정치</strong>이며 법적 효력이 없습니다</li>
            <li>과실비율 판단은 참고용으로만 활용하시기 바랍니다</li>
            <li>실제 법적 판단은 전문 변호사와 상담하시기 바랍니다</li>
            <li>생성된 릴스 영상은 엔터테인먼트 목적입니다</li>
          </ul>
        </div>

        <div style={{
          background: 'linear-gradient(90deg, #ef444411, #f59e0b11)',
          border: '1px solid #ef444433',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '28px',
          fontSize: '12px',
          color: '#fca5a5',
          textAlign: 'center',
        }}>
          본 분석은 AI 추정치이며 법적 효력이 없습니다
        </div>

        <button
          onClick={onAccept}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => e.target.style.opacity = '0.85'}
          onMouseLeave={e => e.target.style.opacity = '1'}
        >
          동의하고 시작하기
        </button>
      </div>
    </div>
  );
}
