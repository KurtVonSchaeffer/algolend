import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface BeatShimmerProps {
  triggerFrame: number;
}

export const BeatShimmer: React.FC<BeatShimmerProps> = ({ triggerFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const activeFrame = frame - triggerFrame;
  
  // Shimmer lasts for 15 frames
  if (activeFrame < 0 || activeFrame > 15) return null;

  const translateX = interpolate(activeFrame, [0, 15], [-100, 200]);
  const opacity = interpolate(activeFrame, [0, 7, 15], [0, 0.4, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${translateX}%`,
          width: '50%',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)',
          transform: 'skewX(-20deg)',
          opacity,
        }}
      />
    </div>
  );
};
