import React from 'react';

const FONT = "'Pretendard', -apple-system, sans-serif";

export default function DisclaimerModal({ onAccept }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#050507',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      fontFamily: FONT,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(14, 14, 18, 0.95)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: '36px 28px',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56,
            background: 'rgba(194,90,90,0.08)',
            border: '1px solid rgba(194,90,90,0.2)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01" stroke="#c25a5a" strokeWidth="2" strokeLinecap="round" />
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#c25a5a" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <h2 style={{
            fontSize: 18, fontWeight: 600,
            color: '#fafafc',
            marginBottom: 6,
          }}>법적 면책 고지</h2>
          <p style={{ fontSize: 12, color: '#8b8e96' }}>
            서비스 이용 전 아래 내용을 확인해 주세요
          </p>
        </div>

        {/* Content */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
          padding: '18px 16px',
          marginBottom: 20,
        }}>
          <p style={{ color: '#c8cad0', fontSize: 13, lineHeight: 1.8, marginBottom: 12 }}>
            본 서비스는 <span style={{ color: '#fafafc', fontWeight: 500 }}>AI 기반 블랙박스 사고 분석 시뮬레이터</span>입니다.
          </p>
          <ul style={{
            color: '#8b8e96', fontSize: 12, lineHeight: 2.2,
            paddingLeft: 16, listStyle: 'none',
          }}>
            {[
              '분석 결과는 AI 추정치이며 법적 효력이 없습니다',
              '과실비율 판단은 참고용으로만 활용하시기 바랍니다',
              '실제 법적 판단은 전문 변호사와 상담하시기 바랍니다',
              '생성된 릴스 영상은 엔터테인먼트 목적입니다',
            ].map((text, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#54565c', flexShrink: 0, marginTop: 2 }}>·</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Warning badge */}
        <div style={{
          background: 'rgba(194,90,90,0.05)',
          border: '1px solid rgba(194,90,90,0.15)',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 24,
          fontSize: 11,
          color: '#a06060',
          textAlign: 'center',
          letterSpacing: '0.02em',
        }}>
          본 분석은 AI 추정치이며 법적 효력이 없습니다
        </div>

        {/* CTA */}
        <button
          onClick={onAccept}
          style={{
            width: '100%',
            padding: '14px',
            background: '#fafafc',
            border: 'none',
            borderRadius: 100,
            color: '#0a0a0c',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: FONT,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          동의하고 시작하기
        </button>
      </div>
    </div>
  );
}
