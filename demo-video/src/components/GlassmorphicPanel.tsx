import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont();

interface GlassmorphicPanelProps {
  title: string;
  items: string[];
  style?: React.CSSProperties;
}

export const GlassmorphicPanel: React.FC<GlassmorphicPanelProps> = ({ title, items, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animate panel entry
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.5 },
  });

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Glowing neon-purple border animation
  const borderGlow = interpolate(frame, [0, 30, 60], [0.3, 0.8, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        left: 80,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(16px)',
        borderRadius: 24,
        padding: '32px 48px',
        color: '#ffffff',
        fontFamily,
        boxShadow: `0 0 40px rgba(139, 92, 246, ${borderGlow * 0.5}), inset 0 0 2px rgba(255,255,255,0.2)`,
        border: `1px solid rgba(139, 92, 246, ${borderGlow})`,
        transform: `scale(${entrance}) translateY(${(1 - entrance) * 50}px)`,
        opacity,
        maxWidth: 800,
        ...style,
      }}
    >
      <h2
        style={{
          margin: '0 0 16px 0',
          fontSize: 32,
          fontWeight: 700,
          background: 'linear-gradient(to right, #ffffff, #c4b5fd)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {title}
      </h2>
      <ul style={{ margin: 0, paddingLeft: 24, fontSize: 24, color: '#e2e8f0', lineHeight: 1.6 }}>
        {items.map((item, index) => {
          // Stagger items
          const itemFrame = Math.max(0, frame - 10 - index * 5);
          const itemOpacity = interpolate(itemFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
          const itemX = interpolate(itemFrame, [0, 10], [-20, 0], { extrapolateRight: 'clamp' });

          return (
            <li
              key={index}
              style={{
                opacity: itemOpacity,
                transform: `translateX(${itemX}px)`,
                marginBottom: 8,
              }}
            >
              {item}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
