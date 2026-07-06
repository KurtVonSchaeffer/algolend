import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';

const { fontFamily: montserratFont } = loadMontserrat();

export const IntroGraphic: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Draw arched line mask (0 to 1)
  const drawProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 200 },
    durationInFrames: 45, // 1.5 seconds to draw
  });

  // Soft bounce for the central dark circle
  const circleScale = spring({
    frame: frame - 40,
    fps,
    config: { damping: 12, mass: 0.8 },
  });

  // Text wipe blur dissolve
  const textWipeProgress = spring({
    frame: frame - 50,
    fps,
    config: { damping: 20, mass: 1 },
  });

  const textBlur = interpolate(textWipeProgress, [0, 1], [20, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const textOpacity = interpolate(textWipeProgress, [0, 1], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  // Subtitle fade in
  const subtitleOpacity = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const subtitleY = interpolate(frame, [80, 100], [20, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #1e003a 0%, #080010 100%)',
      }}
    >
      {/* SVG Logo Assembly */}
      <div style={{ position: 'relative', width: 200, height: 200, marginBottom: 40 }}>
        {/* The arched purple icon (line-mask) */}
        <svg width="200" height="200" viewBox="0 0 200 200">
          {/* Asymmetrical arch: long left leg, semi-circle top, short right leg */}
          <path
            d="M 40 160 L 40 80 A 40 40 0 0 1 120 80 L 120 100"
            fill="transparent"
            stroke="url(#neon-purple)"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={400}
            strokeDashoffset={400 * (1 - drawProgress)}
          />
          <defs>
            <linearGradient id="neon-purple" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6d28d9" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* The central dark circle */}
        <div
          style={{
            position: 'absolute',
            top: 50,
            left: 50,
            width: 60,
            height: 60,
            borderRadius: '50%',
            backgroundColor: '#0f172a',
            transform: `scale(${circleScale})`,
          }}
        />
      </div>

      {/* Typography: AlgoLend Wipe */}
      <div
        style={{
          fontSize: 96,
          fontFamily: montserratFont,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-2px',
          filter: `blur(${textBlur}px)`,
          opacity: textOpacity,
          clipPath: `inset(0 ${100 - textWipeProgress * 100}% 0 0)`, // Wipe left to right
          textShadow: '0 0 40px rgba(126, 34, 206, 0.4)',
        }}
      >
        AlgoLend
      </div>

      {/* Kinetic Text / Subtitle */}
      <div
        style={{
          marginTop: 24,
          fontSize: 32,
          fontWeight: 500,
          color: '#e9d5ff',
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
          letterSpacing: '2px',
          textTransform: 'uppercase',
        }}
      >
        Bespoke End-to-End Digital Credit Platform
      </div>
    </div>
  );
};
