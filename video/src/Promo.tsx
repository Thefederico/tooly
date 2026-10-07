import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const VOID = "#05070f";
const BLUE = "#0070d1";
const CYAN = "#00f0ff";

const CUTS = [
  { name: "title", start: 0, duration: 75 },
  { name: "connect", start: 75, duration: 120 },
  { name: "dashboard", start: 195, duration: 180 },
  { name: "install", start: 375, duration: 135 },
  { name: "cta", start: 510, duration: 90 },
] as const;

const Scene = ({
  children,
  duration,
}: {
  children: React.ReactNode;
  duration: number;
}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [duration - 10, duration], [1, 0], {
    extrapolateLeft: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        opacity: fadeIn * fadeOut,
        background: `radial-gradient(ellipse at center, #0a0e1a 0%, ${VOID} 70%)`,
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Glyphs = () => {
  const frame = useCurrentFrame();
  const glyphs = ["△", "◯", "✕", "□"];
  return (
    <>
      {glyphs.map((g, i) => (
        <div
          key={g}
          style={{
            position: "absolute",
            fontSize: 46,
            color: CYAN,
            opacity: 0.16,
            left: `${8 + i * 26}%`,
            top: `${14 + ((i * 41) % 66)}%`,
            transform: `translateY(${Math.sin((frame + i * 40) / 25) * 14}px) rotate(${frame * (i % 2 === 0 ? 0.4 : -0.4)}deg)`,
          }}
        >
          {g}
        </div>
      ))}
    </>
  );
};

const Caption = ({
  text,
  enterAt = 8,
}: {
  text: string;
  enterAt?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - enterAt, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        textAlign: "center",
        opacity: s,
        transform: `translateY(${(1 - s) * 30}px)`,
        fontSize: 44,
        fontWeight: 700,
        color: "#fff",
        textShadow: `0 0 30px ${BLUE}`,
        padding: "0 40px",
      }}
    >
      {text}
    </div>
  );
};

const BigText = ({
  title,
  sub,
  small,
  enterAt = 0,
}: {
  title: string;
  sub?: string;
  small?: string;
  enterAt?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - enterAt, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        textAlign: "center",
        opacity: s,
        transform: `scale(${0.92 + s * 0.08})`,
        padding: "0 60px",
      }}
    >
      <div
        style={{
          fontSize: 130,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: -3,
          textShadow: `0 0 50px ${BLUE}`,
        }}
      >
        {title}
      </div>
      {sub ? (
        <div
          style={{
            fontSize: 46,
            color: CYAN,
            marginTop: 22,
            fontWeight: 600,
          }}
        >
          {sub}
        </div>
      ) : null}
      {small ? (
        <div
          style={{
            fontSize: 28,
            color: "#7f97b8",
            marginTop: 18,
            fontFamily: "monospace",
          }}
        >
          {small}
        </div>
      ) : null}
    </div>
  );
};

const Shot = ({
  src,
  zoomTo = 1.05,
}: {
  src: string;
  zoomTo?: number;
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const panelWidth = vertical ? 960 : 1520;
  const scale = interpolate(frame, [0, 180], [1, zoomTo], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: vertical ? 64 : 48,
        paddingBottom: vertical ? 0 : 20,
      }}
    >
      <div
        style={{
          width: panelWidth,
          borderRadius: 18,
          overflow: "hidden",
          border: `1px solid rgba(0, 240, 255, 0.35)`,
          boxShadow: `0 0 70px rgba(0, 112, 209, 0.4), 0 25px 60px rgba(0, 0, 0, 0.6)`,
          transform: `scale(${scale})`,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{ width: "100%", display: "block" }}
        />
      </div>
    </AbsoluteFill>
  );
};

const BeatCaption = ({
  text,
  at,
  duration,
}: {
  text: string;
  at: number;
  duration: number;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [at, at + 12, at + duration - 12, at + duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: "7%",
        width: "100%",
        textAlign: "center",
        opacity,
        fontSize: 44,
        fontWeight: 700,
        color: "#fff",
        textShadow: `0 0 30px ${BLUE}, 0 2px 12px rgba(0,0,0,0.8)`,
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {text}
    </div>
  );
};

export const PROMO: React.FC = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;

  return (
    <AbsoluteFill style={{ background: VOID }}>
      <Glyphs />

      <Sequence from={CUTS[0].start} durationInFrames={CUTS[0].duration}>
        <Scene duration={CUTS[0].duration}>
          <AbsoluteFill
            style={{ justifyContent: "center", alignItems: "center" }}
          >
            <BigText
              title="TOOLY"
              sub="PS5 Homebrew Updater"
              small="Scan △ Verify ◯ Install ✕"
            />
          </AbsoluteFill>
        </Scene>
      </Sequence>

      <Sequence from={CUTS[1].start} durationInFrames={CUTS[1].duration}>
        <Scene duration={CUTS[1].duration}>
          <Shot src="shots/01-connect.png" />
          <BeatCaption
            text="Auto-detect your PS5 on the LAN"
            at={14}
            duration={CUTS[1].duration}
          />
        </Scene>
      </Sequence>

      <Sequence from={CUTS[2].start} durationInFrames={CUTS[2].duration}>
        <Scene duration={CUTS[2].duration}>
          <Shot src="shots/02-dashboard.png" zoomTo={1.08} />
          <BeatCaption
            text="Every installed app, scanned over FTP"
            at={14}
            duration={80}
          />
          <BeatCaption
            text="Updates found — checked against GitHub"
            at={94}
            duration={CUTS[2].duration - 94}
          />
        </Scene>
      </Sequence>

      <Sequence from={CUTS[3].start} durationInFrames={CUTS[3].duration}>
        <Scene duration={CUTS[3].duration}>
          <Shot src="shots/03-installing.png" />
          <BeatCaption
            text="One click. Installed via DPI."
            at={14}
            duration={CUTS[3].duration}
          />
        </Scene>
      </Sequence>

      <Sequence from={CUTS[4].start} durationInFrames={CUTS[4].duration}>
        <Scene duration={CUTS[4].duration}>
          <AbsoluteFill
            style={{ justifyContent: "center", alignItems: "center" }}
          >
            <BigText
              title="Tooly"
              sub="Zero USB. Zero manual work."
              small="github.com/Thefederico/tooly"
              enterAt={6}
            />
          </AbsoluteFill>
        </Scene>
      </Sequence>
    </AbsoluteFill>
  );
};
