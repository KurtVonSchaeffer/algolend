import React, { useEffect, useState } from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

export interface Subtitle {
  startFrames: number;
  endFrames: number;
  text: string[];
}

export function parseSrt(srt: string, fps: number): Subtitle[] {
  const blocks = srt.replace(/\r/g, '').trim().split(/\n\s*\n/);
  return blocks.map(block => {
    const lines = block.split('\n');
    const timeLine = lines[1];
    const [start, end] = timeLine.split(' --> ');
    return {
      startFrames: timeToFrames(start, fps),
      endFrames: timeToFrames(end, fps),
      text: lines.slice(2)
    };
  });
}

function timeToFrames(timeStr: string, fps: number) {
  const [hh, mm, ss] = timeStr.split(':');
  const [s, ms] = ss.split(',');
  const seconds = parseInt(hh) * 3600 + parseInt(mm) * 60 + parseInt(s) + parseInt(ms) / 1000;
  return Math.round(seconds * fps);
}

export const Captions: React.FC<{ srtContent: string }> = ({ srtContent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);

  useEffect(() => {
    setSubtitles(parseSrt(srtContent, fps));
  }, [srtContent, fps]);

  const activeSubtitle = subtitles.find(s => frame >= s.startFrames && frame < s.endFrames);

  if (!activeSubtitle) return null;

  const duration = activeSubtitle.endFrames - activeSubtitle.startFrames;
  const localFrame = frame - activeSubtitle.startFrames;

  // Animate in and out
  const opacity = interpolate(
    localFrame,
    [0, 10, duration - 10, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const translateY = interpolate(
    localFrame,
    [0, 15, duration - 15, duration],
    [20, 0, 0, 20],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div style={{
      position: 'absolute',
      bottom: 60,
      left: '10%',
      width: '80%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      opacity,
      transform: `translateY(${translateY}px)`
    }}>
      <div style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: 20,
        padding: '24px 48px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(139, 92, 246, 0.2)',
        textAlign: 'center'
      }}>
        {activeSubtitle.text.map((line, i) => (
          <div key={i} style={{
            fontSize: i === 0 ? 36 : 28,
            fontWeight: i === 0 ? 700 : 400,
            color: i === 0 ? '#c4b5fd' : '#e2e8f0',
            marginBottom: i === 0 ? 8 : 0,
            textShadow: '0 2px 10px rgba(0,0,0,0.8)',
            fontFamily: 'Montserrat, sans-serif'
          }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};
