import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';

const { fontFamily: interFont } = loadFont();
const { fontFamily: montserratFont } = loadMontserrat();

export interface SlideCue {
  /** Frame at which this slide becomes active */
  from: number;
  headline: string;
  subcaption: string;
}

const CROSSFADE = 18;

/**
 * Frosted-glass lower-third that cross-fades between kinetic typography cues.
 * Matches spec: 65% opacity white fill, 40px backdrop blur, 1px white/20% border.
 */
export const KineticSlide: React.FC<{ cues: SlideCue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();

  const activeIndex = [...cues].reverse().findIndex((c) => frame >= c.from);
  const resolvedIndex = activeIndex === -1 ? -1 : cues.length - 1 - activeIndex;
  if (resolvedIndex === -1) return null;

  const active = cues[resolvedIndex];
  const next = cues[resolvedIndex + 1];
  const localFrame = frame - active.from;

  const enterOpacity = interpolate(localFrame, [0, CROSSFADE], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const enterY = interpolate(localFrame, [0, CROSSFADE], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cross-fade out as the next cue's entrance overlaps this one
  let exitOpacity = 1;
  if (next) {
    const framesUntilNext = next.from - frame;
    exitOpacity = interpolate(framesUntilNext, [0, CROSSFADE], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  const opacity = Math.min(enterOpacity, exitOpacity);

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 45,
        bottom: 90,
        left: '50%',
        transform: `translateX(-50%) translateY(${enterY}px)`,
        opacity,
        width: '72%',
        maxWidth: 1040,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '28px 56px',
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 20px 60px rgba(13, 11, 24, 0.35), 0 0 0 1px rgba(138, 43, 226, 0.08)',
      }}
    >
      <div
        style={{
          fontFamily: montserratFont,
          fontWeight: 800,
          fontSize: 38,
          letterSpacing: '-0.5px',
          color: '#1F1135',
          marginBottom: 8,
        }}
      >
        {active.headline}
      </div>
      <div
        style={{
          fontFamily: interFont,
          fontWeight: 500,
          fontSize: 22,
          color: '#5b4b78',
        }}
      >
        {active.subcaption}
      </div>
      <div
        style={{
          marginTop: 14,
          width: 64,
          height: 3,
          borderRadius: 2,
          background: 'linear-gradient(90deg, #8A2BE2, #A020F0)',
          boxShadow: '0 0 16px rgba(138, 43, 226, 0.7)',
        }}
      />
    </div>
  );
};
