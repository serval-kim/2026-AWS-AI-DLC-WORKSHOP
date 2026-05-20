import React from 'react';

/**
 * VideoTemplate
 *
 * general_video_template.html 기반의 9:16 세로형 영상 썸네일/프리뷰 컴포넌트.
 *
 * Props:
 *   titleLine1   {string}  - 첫 번째 타이틀 줄 (노란색)
 *   titleLine2   {string}  - 두 번째 타이틀 줄 (빨간색)
 *   subtitle     {string}  - 하단 자막 텍스트
 *   subtitleLabel {string} - 자막 레이블 (기본: "스크립트 자막 영역")
 *   videoContent {node}    - 영상 영역에 렌더링할 React 노드 (없으면 플레이스홀더)
 *   personImage  {string}  - 우측 하단 인물 이미지 URL (없으면 플레이스홀더)
 *   scale        {number}  - 렌더링 스케일 (기본: 0.35 → 378×661px)
 *   className    {string}  - 외부 래퍼에 추가할 클래스
 *   style        {object}  - 외부 래퍼에 추가할 인라인 스타일
 */
export default function VideoTemplate({
  titleLine1 = '타이틀 한 줄',
  titleLine2 = '타이틀 두 번째 줄',
  subtitle = '여기에 스크립트 자막이 들어갑니다\n두 줄까지 표시되는 자막 영역입니다',
  subtitleLabel = '스크립트 자막 영역',
  videoContent = null,
  personImage = null,
  personVideo = null,
  scale = 0.35,
  className = '',
  style = {},
}) {
  // 원본 캔버스 크기 (HTML 템플릿 기준)
  const CANVAS_W = 1080;
  const CANVAS_H = 1920;

  const scaledW = CANVAS_W * scale;
  const scaledH = CANVAS_H * scale;

  return (
    <div
      className={className}
      style={{
        width: scaledW,
        height: scaledH,
        flexShrink: 0,
        ...style,
      }}
    >
      {/* scale-origin: top-left 로 원본 크기 캔버스를 축소 */}
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          position: 'relative',
          overflow: 'hidden',
          color: 'white',
          fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: `
            radial-gradient(circle at 50% 20%, rgba(20, 120, 255, .20), transparent 34%),
            radial-gradient(circle at 50% 100%, rgba(0, 180, 255, .18), transparent 35%),
            linear-gradient(180deg, #06091a 0%, #08122c 100%)
          `,
        }}
      >
        {/* 배경 그리드 패턴 */}
        <GridPattern />

        {/* 타이틀 */}
        <div style={{
          position: 'absolute',
          top: 110,
          width: '100%',
          textAlign: 'center',
          fontWeight: 1000,
          letterSpacing: '-0.06em',
          lineHeight: 0.98,
          textShadow: '0 6px 0 rgba(0,0,0,.35)',
        }}>
          <span style={{
            display: 'block',
            color: '#fff200',
            fontSize: 116,
            marginBottom: 22,
          }}>
            {titleLine1}
          </span>
          <span style={{
            display: 'block',
            color: '#f31818',
            fontSize: 122,
          }}>
            {titleLine2}
          </span>
        </div>

        {/* 영상 영역 */}
        <div style={{
          position: 'absolute',
          left: 48,
          right: 48,
          top: 410,
          height: 860,
          border: '5px solid #49d6ff',
          borderRadius: 18,
          background: `
            linear-gradient(135deg, rgba(255,255,255,.08), transparent 26%),
            #111
          `,
          boxShadow: '0 0 25px rgba(73, 214, 255, .85), inset 0 0 80px rgba(255,255,255,.03)',
          overflow: 'hidden',
          // videoContent가 있으면 꽉 채우기, 없으면 플레이스홀더 중앙 정렬
          display: videoContent ? 'block' : 'grid',
          placeItems: videoContent ? undefined : 'center',
        }}>
          {videoContent
            ? <div style={{ width: '100%', height: '100%' }}>{videoContent}</div>
            : (
              <span style={{ color: 'rgba(255,255,255,.22)', fontSize: 52, fontWeight: 900 }}>
                영상 영역
              </span>
            )
          }
        </div>

        {/* 자막 박스 */}
        <div style={{
          position: 'absolute',
          left: 48,
          right: 300,
          bottom: 250,
          minHeight: 245,
          padding: '38px 44px',
          border: '4px solid #148bff',
          background: 'rgba(4, 12, 31, .78)',
          boxShadow: '0 0 18px rgba(0, 140, 255, .55)',
          clipPath: 'polygon(0 0, 82% 0, 88% 20%, 100% 20%, 100% 100%, 0 100%)',
        }}>
          <div style={{
            color: '#00c8ff',
            fontWeight: 900,
            fontSize: 34,
            marginBottom: 24,
          }}>
            {subtitleLabel}
          </div>
          <div style={{
            fontSize: 52,
            lineHeight: 1.38,
            fontWeight: 900,
            letterSpacing: '-0.04em',
            wordBreak: 'keep-all',
            whiteSpace: 'pre-line',
          }}>
            {subtitle}
          </div>
        </div>

        {/* 인물 영역 */}
        <PersonSlot image={personImage} video={personVideo} />

        {/* 하단 프레임 */}
        <HexFrame position="bottom" />

        {/* 가이드 테두리 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          border: '14px solid rgba(0,0,0,.18)',
        }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   서브 컴포넌트
───────────────────────────────────────── */

/** 배경 사이버펑크 그리드 패턴 */
function GridPattern() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      opacity: 0.42,
      backgroundImage: `
        linear-gradient(135deg, transparent 0 46%, rgba(0, 180, 255, .45) 47% 48%, transparent 49%),
        linear-gradient(45deg, transparent 0 47%, rgba(44, 114, 255, .32) 48% 49%, transparent 50%)
      `,
      backgroundSize: '180px 180px',
      maskImage: 'linear-gradient(to bottom, transparent, black 18%, black 88%, transparent)',
      WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 18%, black 88%, transparent)',
      pointerEvents: 'none',
    }} />
  );
}

/** 상단/하단 육각형 네온 프레임 */
function HexFrame({ position }) {
  const isTop = position === 'top';
  return (
    <div style={{
      position: 'absolute',
      left: 26,
      right: 26,
      height: 86,
      ...(isTop ? { top: 24 } : { bottom: 24 }),
      border: '4px solid #147cff',
      boxShadow: '0 0 18px rgba(0, 194, 255, .75), inset 0 0 14px rgba(0, 194, 255, .35)',
      clipPath: 'polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)',
      opacity: 0.95,
    }} />
  );
}

/** 우측 하단 인물 슬롯 */
function PersonSlot({ image, video }) {
  return (
    <div style={{
      position: 'absolute',
      right: 28,
      bottom: 155,
      width: 330,
      height: 520,
      borderRadius: '170px 170px 0 0',
      overflow: 'hidden',
      filter: 'drop-shadow(0 0 18px rgba(0,0,0,.65))',
    }}>
      {video ? (
        <video
          src={video}
          autoPlay
          loop
          muted={false}
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
          }}
        />
      ) : image ? (
        <img
          src={image}
          alt="인물"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
          }}
        />
      ) : (
        /* 플레이스홀더 */
        <div style={{
          width: '100%',
          height: '100%',
          background: `
            radial-gradient(circle at 50% 18%, #f1d7c8 0 18%, transparent 19%),
            linear-gradient(#111a2e 36%, #070a12 36%)
          `,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          fontSize: 30,
          fontWeight: 900,
          lineHeight: 1.25,
          color: 'rgba(255,255,255,.8)',
          whiteSpace: 'pre',
        }}>
          {'한문철\n배경제거\n이미지'}
        </div>
      )}
    </div>
  );
}
