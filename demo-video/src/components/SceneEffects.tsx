import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

/** A region of the screen expressed in percentages, used to anchor overlays to UI elements. */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const boxToStyle = (box: Box): React.CSSProperties => ({
  position: 'absolute',
  top: `${box.top}%`,
  left: `${box.left}%`,
  width: `${box.width}%`,
  height: `${box.height}%`,
});

/** Animated glowing neon border that traces the outline of a UI region on click. */
export const NeonBorderTrace: React.FC<{ triggerFrame: number; box: Box; durationInFrames?: number }> = ({
  triggerFrame,
  box,
  durationInFrames = 36,
}) => {
  const frame = useCurrentFrame();
  const local = frame - triggerFrame;
  if (local < 0 || local > durationInFrames) return null;

  const draw = interpolate(local, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const fade = interpolate(local, [durationInFrames - 14, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
  const glow = interpolate(local, [0, 10, durationInFrames], [0, 1, 0.3]);

  return (
    <div style={{ ...boxToStyle(box), pointerEvents: 'none', zIndex: 40, opacity: fade }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <rect
          x="2"
          y="2"
          width="calc(100% - 4px)"
          height="calc(100% - 4px)"
          rx="14"
          fill="none"
          stroke="#A020F0"
          strokeWidth="3"
          strokeDasharray="1"
          pathLength={1}
          strokeDashoffset={1 - draw}
          style={{ filter: `drop-shadow(0 0 ${6 + glow * 14}px rgba(160, 32, 240, ${0.5 + glow * 0.5}))` }}
        />
      </svg>
    </div>
  );
};

/** Full-frame exposure flare / lighting burst, used for "the drop" beat. */
export const ExposureFlare: React.FC<{ triggerFrame: number; durationInFrames?: number }> = ({
  triggerFrame,
  durationInFrames = 24,
}) => {
  const frame = useCurrentFrame();
  const local = frame - triggerFrame;
  if (local < 0 || local > durationInFrames) return null;

  const opacity = interpolate(local, [0, 5, durationInFrames], [0, 0.85, 0]);
  const scale = interpolate(local, [0, durationInFrames], [0.6, 1.6]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 60,
        opacity,
        background:
          'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.95) 0%, rgba(160,32,240,0.55) 28%, rgba(13,11,24,0) 65%)',
        transform: `scale(${scale})`,
        mixBlendMode: 'screen',
      }}
    />
  );
};

/** High-contrast directional shimmer sweep across a region. */
export const DirectionalShimmer: React.FC<{ triggerFrame: number; box: Box; durationInFrames?: number }> = ({
  triggerFrame,
  box,
  durationInFrames = 26,
}) => {
  const frame = useCurrentFrame();
  const local = frame - triggerFrame;
  if (local < 0 || local > durationInFrames) return null;

  const translateX = interpolate(local, [0, durationInFrames], [-120, 220]);
  const opacity = interpolate(local, [0, durationInFrames * 0.4, durationInFrames], [0, 0.5, 0]);

  return (
    <div style={{ ...boxToStyle(box), overflow: 'hidden', pointerEvents: 'none', zIndex: 35 }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${translateX}%`,
          width: '45%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)',
          transform: 'skewX(-18deg)',
          opacity,
        }}
      />
    </div>
  );
};

/** Slow continuous micro-pan — wraps children and gently drifts them. */
export const MicroPan: React.FC<{ children: React.ReactNode; startFrame: number; durationInFrames: number; distance?: number }> = ({
  children,
  startFrame,
  durationInFrames,
  distance = 14,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const progress = interpolate(local, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const x = interpolate(progress, [0, 1], [-distance / 2, distance / 2]);
  const y = interpolate(progress, [0, 1], [distance / 4, -distance / 4]);

  return <div style={{ width: '100%', height: '100%', transform: `translate(${x}px, ${y}px)` }}>{children}</div>;
};

/** Localized neon-accented bounding box that flashes around an active UI element. */
export const BoundingBoxFlash: React.FC<{ triggerFrame: number; box: Box; durationInFrames?: number }> = ({
  triggerFrame,
  box,
  durationInFrames = 50,
}) => {
  const frame = useCurrentFrame();
  const local = frame - triggerFrame;
  if (local < 0 || local > durationInFrames) return null;

  const pulse = Math.sin((local / durationInFrames) * Math.PI * 3) * 0.5 + 0.5;
  const opacity = interpolate(
    local,
    [0, 8, durationInFrames - 10, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        ...boxToStyle(box),
        pointerEvents: 'none',
        zIndex: 40,
        borderRadius: 12,
        border: '2.5px solid #A020F0',
        boxShadow: `0 0 ${14 + pulse * 18}px rgba(160, 32, 240, ${0.55 + pulse * 0.35}), inset 0 0 ${10 + pulse * 10}px rgba(160, 32, 240, 0.25)`,
        opacity,
      }}
    />
  );
};

/** Pulsating glow applied around status badges (e.g. "Operational", "SureSystems Connected"). */
export const PulsingGlowBadge: React.FC<{ startFrame: number; box: Box; durationInFrames?: number }> = ({
  startFrame,
  box,
  durationInFrames = 84,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0 || local > durationInFrames) return null;

  const entrance = interpolate(local, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const pulse = (Math.sin((local / 18) * Math.PI * 2) + 1) / 2;

  return (
    <div
      style={{
        ...boxToStyle(box),
        pointerEvents: 'none',
        zIndex: 38,
        borderRadius: 999,
        opacity: entrance,
        boxShadow: `0 0 ${10 + pulse * 22}px rgba(138, 43, 226, ${0.4 + pulse * 0.45})`,
        border: `1px solid rgba(160, 32, 240, ${0.35 + pulse * 0.4})`,
      }}
    />
  );
};

/** Underline fill accent that draws left-to-right beneath a label, synced to a musical hit. */
export const UnderlineAccent: React.FC<{ triggerFrame: number; box: Box; durationInFrames?: number }> = ({
  triggerFrame,
  box,
  durationInFrames = 20,
}) => {
  const frame = useCurrentFrame();
  const local = frame - triggerFrame;
  if (local < 0 || local > durationInFrames + 30) return null;

  const fill = interpolate(local, [0, durationInFrames], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(local, [0, 6, durationInFrames + 24, durationInFrames + 30], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ ...boxToStyle(box), pointerEvents: 'none', zIndex: 38, opacity }}>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 4,
          width: `${fill}%`,
          borderRadius: 2,
          background: 'linear-gradient(90deg, #8A2BE2, #A020F0)',
          boxShadow: '0 0 14px rgba(160, 32, 240, 0.8)',
        }}
      />
    </div>
  );
};
