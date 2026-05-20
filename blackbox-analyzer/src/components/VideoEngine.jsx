import React, { useRef, useEffect, useState } from 'react';

/**
 * VideoEngine
 *
 * muncheol-script-oneshot.json + 원본 MP4 → 브라우저 실시간 편집 재현
 *
 * 핵심 설계:
 *   - video.currentTime : 원본 영상 위치 (0~10s)  ← 클립 제어용
 *   - elapsed           : 릴스 재생 시간 (0~60s)  ← Date.now() 기반, 독립 추적
 *
 * Props:
 *   src             {string}   원본 MP4 URL
 *   script          {object}   muncheol-script-oneshot.json
 *   autoPlay        {boolean}  마운트 시 자동 재생 (기본: false)
 *   onEnded         {func}     전체 재생 완료 콜백
 *   onSubtitleChange{func}     현재 자막 문장 변경 콜백 (string)
 *   showSubtitle    {boolean}  내부 자막 표시 여부 (기본: true)
 *   style           {object}   래퍼 인라인 스타일
 */
export default function VideoEngine({
  src,
  script,
  autoPlay = false,
  onEnded,
  onSubtitleChange,
  showSubtitle = true,
  style = {},
}) {
  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const freezeTimerRef = useRef(null);

  // 릴스 타이머: 재생 시작 시각(ms) 기록 → elapsed = (now - startedAt) + baseElapsed
  const timerRef = useRef({ startedAt: 0, baseElapsed: 0, running: false });

  const stateRef = useRef({
    sequence: [],
    totalDuration: 0,
    clipIdx: 0,
    playing: false,
  });

  const [ui, setUi] = useState({
    playing: false,
    frozen: false,
    progress: 0,
    elapsed: 0,
    totalDuration: 0,
    clipIdx: 0,
    clipInfo: null,
    section: null,
    ended: false,
  });

  // ── 1. JSON → 시퀀스 평탄화 ──────────────────────────────────
  useEffect(() => {
    if (!script?.script) return;

    const flat = [];
    let acc = 0;

    for (const key of ['intro', 'analysis', 'conclusion']) {
      const sec = script.script[key];
      if (!sec) continue;

      const sectionDuration = sec.duration_sec ?? 0;
      const clips = sec.clips ?? [];
      const sectionStart = acc;

      let clipsTotal = 0;
      const clipsWithDur = clips.map(clip => {
        const s = toSec(clip.start);
        const e = toSec(clip.end);
        const raw = Math.max(e - s, 0.1);
        const pd = playDur(raw, clip.effect);
        clipsTotal += pd;
        return { ...clip, startSec: s, endSec: e, rawDur: raw, playDur: pd };
      });

      const diff = sectionDuration - clipsTotal;

      clipsWithDur.forEach((clip, i) => {
        const isLast = i === clipsWithDur.length - 1;
        const adjustedPlayDur = isLast
          ? Math.max(clip.playDur + diff, 0.1)
          : clip.playDur;

        flat.push({
          ...clip,
          playDur: adjustedPlayDur,
          sectionKey: key,
          sectionText: sec.text,
          sectionEmphasis: sec.emphasis ?? [],
          sectionStart,
          sectionDuration,
          offsetStart: acc,
        });

        acc += adjustedPlayDur;
      });

      console.log(`[VideoEngine] ${key}: clips=${clipsTotal.toFixed(1)}s → duration_sec=${sectionDuration}s`);
    }

    console.log(`[VideoEngine] totalDuration=${acc.toFixed(1)}s`);

    stateRef.current = { sequence: flat, totalDuration: acc, clipIdx: 0, playing: false };
    timerRef.current = { startedAt: 0, baseElapsed: 0, running: false };

    const first = flat[0];
    setUi(u => ({
      ...u,
      totalDuration: acc,
      clipIdx: 0,
      progress: 0,
      elapsed: 0,
      playing: false,
      frozen: false,
      ended: false,
      clipInfo: first ? { start: first.start, end: first.end, effect: first.effect } : null,
      section: first ? mkSection(first) : null,
    }));

    if (videoRef.current && first) {
      videoRef.current.currentTime = first.startSec;
    }
  }, [script]);

  // ── 릴스 타이머 헬퍼 ─────────────────────────────────────────
  function timerStart() {
    timerRef.current.startedAt = Date.now();
    timerRef.current.running = true;
  }
  function timerPause() {
    if (!timerRef.current.running) return;
    timerRef.current.baseElapsed += (Date.now() - timerRef.current.startedAt) / 1000;
    timerRef.current.running = false;
  }
  function timerReset() {
    timerRef.current = { startedAt: 0, baseElapsed: 0, running: false };
  }
  function timerRead() {
    const t = timerRef.current;
    if (!t.running) return t.baseElapsed;
    return t.baseElapsed + (Date.now() - t.startedAt) / 1000;
  }

  // ── 2. 클립 전환 ─────────────────────────────────────────────
  function goToClip(idx, shouldPlay) {
    const video = videoRef.current;
    const st = stateRef.current;
    if (!video) return;

    cancelAnimationFrame(rafRef.current);
    clearTimeout(freezeTimerRef.current);

    st.clipIdx = idx;

    if (idx >= st.sequence.length) {
      video.pause();
      st.playing = false;
      timerPause();
      const total = st.totalDuration;
      setUi(u => ({ ...u, playing: false, frozen: false, ended: true, progress: 100, elapsed: total }));
      onEnded?.();
      return;
    }

    const clip = st.sequence[idx];

    setUi(u => ({
      ...u,
      clipIdx: idx,
      clipInfo: { start: clip.start, end: clip.end, effect: clip.effect },
      section: mkSection(clip),
      frozen: false,
      ended: false,
    }));

    // 원본 영상 seek
    video.currentTime = clip.startSec;

    if (clip.effect === 'freeze') {
      video.pause();
      setUi(u => ({ ...u, frozen: true }));

      if (shouldPlay) {
        // freeze 동안 릴스 타이머는 계속 흐름
        startRaf(); // 진행률 업데이트용 RAF
        freezeTimerRef.current = setTimeout(() => {
          setUi(u => ({ ...u, frozen: false }));
          goToClip(st.clipIdx + 1, true);
        }, clip.playDur * 1000);
      }
      return;
    }

    video.playbackRate = toRate(clip.effect);

    if (shouldPlay) {
      video.play().catch(() => {});
      startRaf();
    }
  }

  // ── 3. RAF 루프 — elapsed는 오직 timerRead()로만 ──────────────
  function startRaf() {
    cancelAnimationFrame(rafRef.current);
    const video = videoRef.current;
    const st = stateRef.current;

    const tick = () => {
      if (!st.playing || !video) return;

      const clip = st.sequence[st.clipIdx];
      if (!clip) return;

      // ── 원본 영상 클립 끝 감지 (freeze 제외) ──
      if (clip.effect !== 'freeze' && video.currentTime >= clip.endSec - 0.05) {
        // 남은 playDur가 있으면 (duration_sec 맞추기 위해 늘어난 마지막 클립)
        const actualPlayDur = clip.rawDur / toRate(clip.effect);
        const remainFreeze = clip.playDur - actualPlayDur;

        if (remainFreeze > 0.1) {
          video.pause();
          setUi(u => ({ ...u, frozen: true }));
          freezeTimerRef.current = setTimeout(() => {
            setUi(u => ({ ...u, frozen: false }));
            goToClip(st.clipIdx + 1, true);
          }, remainFreeze * 1000);
        } else {
          goToClip(st.clipIdx + 1, true);
        }
        return;
      }

      // ── elapsed: 릴스 타이머 기반 (video.currentTime 무관) ──
      const elapsed = Math.min(timerRead(), st.totalDuration);
      const pct = st.totalDuration > 0 ? (elapsed / st.totalDuration) * 100 : 0;

      setUi(u => ({ ...u, elapsed, progress: Math.min(pct, 100) }));

      // 자막 콜백
      if (onSubtitleChange && clip.sectionText) {
        const sentences = splitSentences(clip.sectionText);
        const secElapsed = Math.max(elapsed - clip.sectionStart, 0);
        const perSentence = clip.sectionDuration / sentences.length;
        const sidx = Math.min(Math.floor(secElapsed / perSentence), sentences.length - 1);
        onSubtitleChange(sentences[sidx] ?? '');
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  // ── 4. 재생/일시정지 토글 ─────────────────────────────────────
  function togglePlay() {
    const video = videoRef.current;
    const st = stateRef.current;
    if (!video || st.sequence.length === 0) return;

    if (st.playing) {
      st.playing = false;
      video.pause();
      timerPause();
      cancelAnimationFrame(rafRef.current);
      clearTimeout(freezeTimerRef.current);
      setUi(u => ({ ...u, playing: false }));
    } else {
      // 끝난 상태면 처음부터
      if (st.clipIdx >= st.sequence.length) {
        timerReset();
        st.clipIdx = 0;
        setUi(u => ({ ...u, elapsed: 0, progress: 0, ended: false }));
      }

      st.playing = true;
      timerStart();
      setUi(u => ({ ...u, playing: true, ended: false }));
      goToClip(st.clipIdx, true);
    }
  }

  // autoPlay
  useEffect(() => {
    if (autoPlay && stateRef.current.sequence.length > 0) {
      stateRef.current.playing = true;
      timerStart();
      setUi(u => ({ ...u, playing: true }));
      goToClip(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, ui.totalDuration]);

  // 언마운트 정리
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(freezeTimerRef.current);
    };
  }, []);

  // ── 렌더 ─────────────────────────────────────────────────────
  const { playing, frozen, progress, elapsed, totalDuration, clipInfo, section, ended } = ui;

  return (
    <div style={{ position: 'relative', background: '#000', width: '100%', height: '100%', minHeight: 120, ...style }}>
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="auto"
        onError={e => console.error('[VideoEngine] error:', e.target.error)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {!src && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
          영상 없음
        </div>
      )}

      {/* Effect 배지 */}
      {clipInfo && clipInfo.effect !== 'normal' && (
        <div style={{ position: 'absolute', top: 8, left: 8,
          background: EFFECT_COLORS[clipInfo.effect] ?? '#3b82f688',
          color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>
          {EFFECT_LABELS[clipInfo.effect] ?? clipInfo.effect}
        </div>
      )}

      {/* 섹션 배지 */}
      {section && (
        <div style={{ position: 'absolute', top: 8, right: 8,
          background: SECTION_COLORS[section.key] ?? '#ffffff22',
          color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>
          {SECTION_LABELS[section.key]}
        </div>
      )}

      {/* 내부 자막 (showSubtitle=true일 때만) */}
      {showSubtitle && section && playing && (
        <Subtitle
          text={section.text}
          emphasis={section.emphasis}
          elapsed={elapsed}
          sectionStart={section.sectionStart}
          sectionDuration={section.sectionDuration}
        />
      )}

      {/* 프로그레스 바 */}
      <div style={{ position: 'absolute', bottom: 44, left: 0, right: 0, padding: '0 10px' }}>
        <div style={{ background: '#ffffff33', borderRadius: 100, height: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
            borderRadius: 100, transition: 'width 0.05s linear' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3,
          fontSize: 9, color: '#ffffff88' }}>
          <span>{fmt(elapsed)}</span>
          <span>{fmt(totalDuration)}</span>
        </div>
      </div>

      {/* 재생 버튼 */}
      <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <button onClick={togglePlay} style={{
          width: 34, height: 34, background: 'rgba(255,255,255,0.18)',
          border: '1.5px solid rgba(255,255,255,0.45)', borderRadius: '50%',
          color: '#fff', fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          {ended ? '↺' : playing ? '⏸' : '▶'}
        </button>
      </div>

      {/* 디버그 */}
      {clipInfo && (
        <div style={{ position: 'absolute', bottom: 80, left: 6,
          fontSize: 8, color: '#ffffff44', fontFamily: 'monospace' }}>
          {ui.clipIdx + 1}/{stateRef.current.sequence.length} · {clipInfo.start}~{clipInfo.end} · {clipInfo.effect}
        </div>
      )}
    </div>
  );
}

// ── 자막 컴포넌트 ─────────────────────────────────────────────
function Subtitle({ text, emphasis = [], elapsed, sectionStart, sectionDuration }) {
  const sentences = React.useMemo(() => splitSentences(text), [text]);
  const secElapsed = Math.max(elapsed - sectionStart, 0);
  const perSentence = sectionDuration / Math.max(sentences.length, 1);
  const idx = Math.min(Math.floor(secElapsed / perSentence), sentences.length - 1);
  const parts = parseEmphasis(sentences[idx] ?? '', emphasis);

  return (
    <div style={{ position: 'absolute', bottom: 90, left: 6, right: 6,
      background: 'rgba(0,0,0,0.72)', borderRadius: 6, padding: '7px 9px', minHeight: 40 }}>
      <p key={idx} style={{ color: '#fff', fontSize: 11, lineHeight: 1.55,
        textAlign: 'center', margin: 0, wordBreak: 'keep-all',
        animation: 'subtitleFadeIn 0.3s ease' }}>
        {parts.map((p, i) =>
          p.hi
            ? <span key={i} style={{ color: '#fff200', fontWeight: 900 }}>{p.t}</span>
            : <span key={i}>{p.t}</span>
        )}
      </p>
    </div>
  );
}

// ── 유틸 ──────────────────────────────────────────────────────
function mkSection(clip) {
  return {
    key: clip.sectionKey,
    text: clip.sectionText,
    emphasis: clip.sectionEmphasis,
    sectionStart: clip.sectionStart,
    sectionDuration: clip.sectionDuration,
  };
}

function splitSentences(text) {
  return text.split(/(?<=[.?!])\s+|(?<=\n)/).map(s => s.trim()).filter(Boolean);
}

function toSec(s) {
  if (!s) return 0;
  const [m, sec] = s.split(':').map(Number);
  return (m || 0) * 60 + (sec || 0);
}

function fmt(sec) {
  const s = Math.max(sec || 0, 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function toRate(effect) {
  return effect === 'slow_2x' ? 0.5 : effect === 'slow_4x' ? 0.25 : 1.0;
}

function playDur(raw, effect) {
  return effect === 'slow_2x' ? raw * 2 : effect === 'slow_4x' ? raw * 4 : raw;
}

function parseEmphasis(text, emphasis = []) {
  const parts = [];
  let last = 0;
  const re = /\*\*(.+?)\*\*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index), hi: false });
    parts.push({ t: m[1], hi: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: text.slice(last), hi: false });
  if (!emphasis.length) return parts;

  const kwRe = new RegExp(`(${emphasis.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return parts.flatMap(p => {
    if (p.hi) return [p];
    const sub = [];
    let sl = 0, sm;
    while ((sm = kwRe.exec(p.t)) !== null) {
      if (sm.index > sl) sub.push({ t: p.t.slice(sl, sm.index), hi: false });
      sub.push({ t: sm[1], hi: true });
      sl = sm.index + sm[0].length;
    }
    if (sl < p.t.length) sub.push({ t: p.t.slice(sl), hi: false });
    return sub.length ? sub : [p];
  });
}

const EFFECT_LABELS = { slow_2x: '× SLOW 2x', slow_4x: '× SLOW 4x', replay: '↺ REPLAY', freeze: '■ FREEZE' };
const EFFECT_COLORS = { slow_2x: '#f59e0b99', slow_4x: '#ef444499', replay: '#8b5cf699', freeze: '#ef444488' };
const SECTION_LABELS = { intro: '도입부', analysis: '분석부', conclusion: '결론부' };
const SECTION_COLORS = { intro: '#3b82f688', analysis: '#f59e0b88', conclusion: '#ef444488' };
