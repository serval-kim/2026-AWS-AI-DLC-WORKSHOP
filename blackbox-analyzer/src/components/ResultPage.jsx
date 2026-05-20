import React, { useState } from "react";

const FONT = "'DungGeunMo', sans-serif";

const MOCK = {
  id: "ANA-2026-0520-7842",
  type: "끼어들기 후 추돌",
  verdict: "7:3",
  fault: { a: 70, b: 30 },
  faultLabel: { a: "상대 차량", b: "내 차량" },
  laws: [
    "도로교통법 제19조 (안전거리 확보)",
    "도로교통법 제23조 (끼어들기 금지)",
  ],
  precedent: "대법원 2023다45821 유사 판례",
  timeline: [
    { time: "00:02", event: "상대 차량 1차선 진입 시도" },
    { time: "00:04", event: "방향지시등 없이 차선 변경" },
    { time: "00:06", event: "충돌 발생" },
    { time: "00:08", event: "양 차량 정차" },
  ],
  script: {
    intro: "자, 보시죠. 이 영상 한번 보겠습니다.",
    analysis:
      "상대방 차량이 방향지시등도 켜지 않고 갑자기 끼어들었습니다. 이건 명백한 끼어들기 위반이에요.",
    conclusion:
      "제 판단은 이렇습니다. 7대 3. 끼어든 차량이 7, 당한 차량이 3입니다.",
  },
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "#050507",
    display: "flex",
    fontFamily: FONT,
    color: "#fafafc",
  },
  left: {
    width: 360,
    minWidth: 320,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
    borderRight: "1px solid rgba(255,255,255,0.06)",
  },
  right: {
    flex: 1,
    padding: "40px 32px",
    overflowY: "auto",
    maxHeight: "100vh",
  },
  reelsFrame: {
    width: "100%",
    maxWidth: 240,
    aspectRatio: "9/16",
    background: "#0c0c10",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  tab: (active) => ({
    padding: "8px 16px",
    background: active ? "rgba(255,255,255,0.08)" : "transparent",
    border: `1px solid ${
      active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"
    }`,
    borderRadius: 6,
    color: active ? "#fafafc" : "#8b8e96",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: FONT,
    transition: "all 0.2s",
  }),
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: "20px",
    marginBottom: 16,
  },
};

// ─── Fault bar ────────────────────────────────────────────────────────────────
function FaultBar({ a, b }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          borderRadius: 100,
          overflow: "hidden",
          height: 14,
          background: "#14141a",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: `${a}%`,
            background: "#c25a5a",
            transition: "width 1s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            color: "#fff",
          }}
        >
          {a}%
        </div>
        <div
          style={{
            width: `${b}%`,
            background: "#5a8ac2",
            transition: "width 1s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            color: "#fff",
          }}
        >
          {b}%
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div
          style={{
            ...S.card,
            textAlign: "center",
            borderColor: "rgba(194,90,90,0.2)",
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 700, color: "#c25a5a" }}>
            {a}%
          </div>
          <div style={{ fontSize: 11, color: "#8b8e96", marginTop: 4 }}>
            {MOCK.faultLabel.a}
          </div>
        </div>
        <div
          style={{
            ...S.card,
            textAlign: "center",
            borderColor: "rgba(90,138,194,0.2)",
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 700, color: "#5a8ac2" }}>
            {b}%
          </div>
          <div style={{ fontSize: 11, color: "#8b8e96", marginTop: 4 }}>
            {MOCK.faultLabel.b}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reels mock player ────────────────────────────────────────────────────────
function ReelsPlayer() {
  const [playing, setPlaying] = useState(false);
  return (
    <div style={S.reelsFrame}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, #0a120a 0%, #1a2a10 50%, #0a0a14 100%)",
        }}
      >
        {/* Mock road */}
        <div
          style={{
            position: "absolute",
            bottom: "25%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "55%",
            height: "30%",
            background: "#1a1a1a",
            clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "32%",
            left: "44%",
            width: "10%",
            height: "7%",
            background: "#c25a5a",
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "40%",
            left: "48%",
            width: "8%",
            height: "5%",
            background: "#5a8ac2",
            borderRadius: 2,
          }}
        />
      </div>

      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          background: "rgba(0,0,0,0.6)",
          borderRadius: 3,
          padding: "2px 6px",
          fontSize: 8,
          color: "rgba(255,255,255,0.5)",
        }}
      >
        AI 분석 - 참고용
      </div>

      {/* Bottom controls */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: 12,
          background: "linear-gradient(0deg, rgba(0,0,0,0.8), transparent)",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.2)",
            borderRadius: 100,
            height: 2,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              height: "100%",
              width: playing ? "60%" : "0%",
              background: "#fff",
              borderRadius: 100,
              transition: "width 3s linear",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={() => setPlaying(!playing)}
            style={{
              width: 32,
              height: 32,
              background: "rgba(255,255,255,0.15)",
              border: "1.5px solid rgba(255,255,255,0.4)",
              borderRadius: "50%",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {playing ? "⏸" : "▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResultPage({ file, analysisResult, onReset }) {
  const [activeTab, setActiveTab] = useState("fault");
  const [liveSubtitle, setLiveSubtitle] = useState("");

  // file prop이 File 객체면 Object URL 생성, 없으면 fallback
  const videoSrc = React.useMemo(() => {
    if (file instanceof File) return URL.createObjectURL(file);
    return "/bb_h264.mp4"; // 개발용 fallback
  }, [file]);

  // 컴포넌트 언마운트 시 Object URL 해제 (메모리 누수 방지)
  React.useEffect(() => {
    return () => {
      if (file instanceof File) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc]);

  const tabs = [
    { id: "fault", label: "과실비율" },
    { id: "timeline", label: "타임라인" },
    { id: "script", label: "스크립트" },
  ];

  return (
    <div style={S.page}>
      {/* ── Left: Reels ── */}
      <div style={S.left}>
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          <p
            style={{
              fontSize: 9,
              color: "#54565c",
              letterSpacing: "0.2em",
              marginBottom: 8,
            }}
          >
            GENERATED REELS
          </p>
          <p style={{ fontSize: 13, color: "#c8cad0" }}>한문철 스타일 릴스</p>
        </div>
        <ReelsPlayer />
        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 10,
            width: "100%",
            maxWidth: 240,
          }}
        >
          <button
            style={{
              flex: 1,
              padding: "10px",
              background: "#fafafc",
              border: "none",
              borderRadius: 100,
              color: "#0a0a0c",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Download
          </button>
          <button
            style={{
              flex: 1,
              padding: "10px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 100,
              color: "#c8cad0",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Share
          </button>
        </div>
      </div>

      {/* ── Right: Data tabs ── */}
      <div style={S.right}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 9,
                color: "#54565c",
                letterSpacing: "0.2em",
                marginBottom: 6,
              }}
            >
              ANALYSIS COMPLETE
            </p>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "#fafafc",
                marginBottom: 4,
              }}
            >
              사고 분석 결과
            </h1>
            <p style={{ fontSize: 11, color: "#54565c" }}>ID: {MOCK.id}</p>
          </div>
          <button
            onClick={onReset}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              color: "#8b8e96",
              padding: "8px 14px",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: FONT,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
              e.currentTarget.style.color = "#fafafc";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              e.currentTarget.style.color = "#8b8e96";
            }}
          >
            + 새 분석
          </button>
        </div>

        {/* Verdict banner */}
        <div
          style={{
            ...S.card,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <p style={{ fontSize: 10, color: "#8b8e96", marginBottom: 4 }}>
              사고 유형
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#fafafc" }}>
              {MOCK.type}
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "#8b8e96", marginBottom: 4 }}>
              AI 판결
            </p>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#c25a5a" }}>
              {MOCK.verdict}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 10, color: "#8b8e96", marginBottom: 4 }}>
              관련 법규
            </p>
            {MOCK.laws.map((l) => (
              <p key={l} style={{ fontSize: 11, color: "#8b8e96" }}>
                · {l}
              </p>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div
          style={{
            background: "rgba(194,90,90,0.04)",
            border: "1px solid rgba(194,90,90,0.15)",
            borderRadius: 6,
            padding: "8px 14px",
            marginBottom: 24,
            fontSize: 10,
            color: "#a06060",
          }}
        >
          ⚠ 본 분석은 AI 추정치이며 법적 효력이 없습니다
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={S.tab(activeTab === t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div key={activeTab} style={{ animation: "fadeIn 0.3s ease" }}>
          {activeTab === "fault" && (
            <div style={S.card}>
              <p style={{ fontSize: 11, color: "#54565c", marginBottom: 16 }}>
                {MOCK.precedent}
              </p>
              <FaultBar a={MOCK.fault.a} b={MOCK.fault.b} />
            </div>
          )}

          {activeTab === "timeline" && (
            <div style={S.card}>
              <div style={{ position: "relative", paddingLeft: 28 }}>
                <div
                  style={{
                    position: "absolute",
                    left: 8,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: "rgba(255,255,255,0.08)",
                  }}
                />
                {MOCK.timeline.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: 18,
                      position: "relative",
                      animation: `fadeIn 0.3s ease ${i * 0.08}s both`,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: -24,
                        top: 4,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.3)",
                        border: "2px solid #050507",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        color: "#54565c",
                        marginRight: 10,
                        fontFamily: FONT,
                      }}
                    >
                      {item.time}
                    </span>
                    <span style={{ fontSize: 13, color: "#c8cad0" }}>
                      {item.event}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "script" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                {
                  label: "도입부",
                  text: MOCK.script.intro,
                  time: "00:00~00:10",
                },
                {
                  label: "분석부",
                  text: MOCK.script.analysis,
                  time: "00:10~00:45",
                },
                {
                  label: "결론부",
                  text: MOCK.script.conclusion,
                  time: "00:45~01:00",
                },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    ...S.card,
                    borderLeft: "3px solid rgba(255,255,255,0.15)",
                    animation: `fadeIn 0.3s ease ${i * 0.1}s both`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "#8b8e96" }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: 9, color: "#54565c" }}>
                      {s.time}
                    </span>
                  </div>
                  <p
                    style={{ fontSize: 14, color: "#fafafc", lineHeight: 1.7 }}
                  >
                    "{s.text}"
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === "reels" && (
            <div
              style={{
                background: "#141c2e",
                border: "1px solid #1e2d4a",
                borderRadius: "16px",
                padding: "24px",
              }}
            >
              <h3
                style={{
                  color: "#f1f5f9",
                  fontSize: "16px",
                  fontWeight: "700",
                  marginBottom: "8px",
                }}
              >
                🎬 릴스 미리보기
              </h3>
              <p
                style={{
                  color: "#475569",
                  fontSize: "12px",
                  marginBottom: "24px",
                }}
              >
                9:16 세로형 · 60초 이내 · MP4
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "24px",
                  alignItems: "start",
                }}
              >
                {/* VideoTemplate + VideoEngine 통합 */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <VideoTemplate
                    titleLine1={MOCK_RESULT.accidentType.split(" ")[0]}
                    titleLine2={
                      MOCK_RESULT.accidentType.split(" ").slice(1).join(" ") ||
                      "사고 분석"
                    }
                    subtitle={liveSubtitle || MOCK_RESULT.script.conclusion}
                    subtitleLabel="AI 판결"
                    scale={0.28}
                    style={{
                      borderRadius: 8,
                      overflow: "hidden",
                      boxShadow: "0 0 24px rgba(0,194,255,.25)",
                    }}
                    videoContent={
                      <VideoEngine
                        src={videoSrc}
                        script={analysisResult?.script || MUNCHEOL_SCRIPT}
                        showSubtitle={false}
                        onSubtitleChange={setLiveSubtitle}
                        style={{ width: "100%", height: "100%" }}
                      />
                    }
                    personVideo={analysisResult?.videoUrl || null}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      background: "#0a0e1a",
                      border: "1px solid #1e2d4a",
                      borderRadius: "12px",
                      padding: "16px",
                    }}
                  >
                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: "11px",
                        marginBottom: "4px",
                      }}
                    >
                      영상 정보
                    </p>
                    {[
                      ["형식", "MP4 (H.264)"],
                      ["비율", "9:16 세로형"],
                      ["길이", "약 58초"],
                      ["자막", "포함"],
                      ["워터마크", "AI 분석 결과 - 참고용"],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "6px 0",
                          borderBottom: "1px solid #1e2d4a",
                        }}
                      >
                        <span style={{ color: "#475569", fontSize: "12px" }}>
                          {k}
                        </span>
                        <span style={{ color: "#f1f5f9", fontSize: "12px" }}>
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    style={{
                      width: "100%",
                      padding: "14px",
                      background: "linear-gradient(135deg, #10b981, #06b6d4)",
                      border: "none",
                      borderRadius: "12px",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: "700",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => (e.target.style.opacity = "0.85")}
                    onMouseLeave={(e) => (e.target.style.opacity = "1")}
                  >
                    ⬇️ 릴스 다운로드
                  </button>
                  <button
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "transparent",
                      border: "1px solid #2d4a7a",
                      borderRadius: "12px",
                      color: "#94a3b8",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = "#3b82f6";
                      e.target.style.color = "#3b82f6";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = "#2d4a7a";
                      e.target.style.color = "#94a3b8";
                    }}
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
