import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { BrowserFrame } from './BrowserFrame';

const { fontFamily: interFont } = loadFont();
const { fontFamily: montserratFont } = loadMontserrat();

export interface SceneSlideProps {
  label: string;
  sublabel?: string;
  portal: 'user' | 'admin' | 'auth';
  callouts?: string[];
  screenshot?: string;
  panFrom?: [number, number];
  panTo?: [number, number];
  zoomStart?: number;
  zoomEnd?: number;
  children?: React.ReactNode;
}

const PORTAL_COLORS: Record<string, { bg: string; text: string; label: string; glow: string }> = {
  auth:  { bg: '#6d28d9', text: '#fff', label: 'AUTH',        glow: 'rgba(109,40,217,0.5)' },
  user:  { bg: '#0ea5e9', text: '#fff', label: 'USER PORTAL', glow: 'rgba(14,165,233,0.5)' },
  admin: { bg: '#b026ff', text: '#fff', label: 'ADMIN',       glow: 'rgba(176,38,255,0.5)' },
};

// Floating orb particle for the dark background
const Orb: React.FC<{ x: number; y: number; size: number; color: string; delay: number; speed: number }> = ({ x, y, size, color, delay, speed }) => {
  const frame = useCurrentFrame();
  const t = (frame - delay) * speed;
  const floatY = Math.sin(t * 0.04) * 18;
  const floatX = Math.cos(t * 0.03) * 10;
  const pulse = interpolate(Math.sin(t * 0.06), [-1, 1], [0.4, 0.85], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (frame < delay) return null;
  return (
    <div style={{
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      opacity: pulse,
      transform: `translate(${floatX}px, ${floatY}px)`,
      filter: `blur(${size * 0.4}px)`,
      pointerEvents: 'none',
    }} />
  );
};

const Callout: React.FC<{ text: string; index: number; totalFrames: number }> = ({ text, index, totalFrames }) => {
  const frame = useCurrentFrame();
  const delay = 22 + index * 16;
  const progress = spring({ frame: frame - delay, fps: 30, config: { damping: 18, mass: 0.5 } });
  const opacity = interpolate(progress, [0, 1], [0, 1], { extrapolateRight: 'clamp' });
  const x = interpolate(progress, [0, 1], [32, 0], { extrapolateRight: 'clamp' });
  const exitOpacity = interpolate(frame, [totalFrames - 16, totalFrames - 4], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const glowPulse = interpolate(Math.sin(frame * 0.15 + index), [-1, 1], [0.6, 1.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{ opacity: opacity * exitOpacity, transform: `translateX(${x}px)`, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      {/* Pulsing dot */}
      <div style={{
        width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #b026ff, #7c3aed)',
        boxShadow: `0 0 ${12 * glowPulse}px rgba(176, 38, 255, 0.9)`,
      }} />
      <div style={{
        fontFamily: interFont, fontSize: 19, fontWeight: 600,
        color: '#f1f5f9', letterSpacing: '0.01em',
        textShadow: '0 1px 8px rgba(0,0,0,0.8)',
      }}>
        {text}
      </div>
    </div>
  );
};

export const SceneSlide: React.FC<SceneSlideProps> = ({
  label,
  sublabel,
  portal,
  callouts = [],
  screenshot,
  panFrom = [0, 0],
  panTo = [1.2, -0.8],
  zoomStart = 1.04,
  zoomEnd = 1.0,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pc = PORTAL_COLORS[portal];

  // ── Entrance: browser frame slides up + fades in ──────────────────────────
  const enterProgress = spring({ frame, fps: 30, config: { damping: 22, mass: 0.8 }, durationInFrames: 32 });
  const frameY = interpolate(enterProgress, [0, 1], [60, 0], { extrapolateRight: 'clamp' });
  const frameOpacity = interpolate(enterProgress, [0, 1], [0, 1], { extrapolateRight: 'clamp' });

  // ── Ken Burns zoom+pan ────────────────────────────────────────────────────
  const zoomSettle = spring({ frame, fps: 30, config: { damping: 24, mass: 0.7 }, durationInFrames: 28 });
  const scale = interpolate(zoomSettle, [0, 1], [zoomStart, zoomEnd]);
  const panX = interpolate(frame, [0, durationInFrames], [panFrom[0], panTo[0]]);
  const panY = interpolate(frame, [0, durationInFrames], [panFrom[1], panTo[1]]);

  // ── Scene fade-out ────────────────────────────────────────────────────────
  const sceneOpacity = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Glow burst on entry ───────────────────────────────────────────────────
  const burstOpacity = interpolate(frame, [0, 8, 28], [0.9, 0.6, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Pulsing aura around frame ─────────────────────────────────────────────
  const auraSize = interpolate(Math.sin(frame * 0.07), [-1, 1], [0, 10], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const auraOpacity = interpolate(frame, [0, 20, durationInFrames - 12, durationInFrames], [0, 0.5, 0.5, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Label entrance ────────────────────────────────────────────────────────
  const labelProgress = spring({ frame: frame - 8, fps: 30, config: { damping: 22, mass: 0.7 } });
  const labelY = interpolate(labelProgress, [0, 1], [-28, 0], { extrapolateRight: 'clamp' });
  const labelOpacity = interpolate(labelProgress, [0, 1], [0, 1], { extrapolateRight: 'clamp' });

  // ── Scan line sweep ───────────────────────────────────────────────────────
  const scanY = interpolate(frame, [0, durationInFrames], [-5, 110], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scanOpacity = interpolate(frame, [0, 12, durationInFrames - 12, durationInFrames], [0, 0.35, 0.35, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>

      {/* ── Background dark gradient ── */}
      <AbsoluteFill style={{ background: 'linear-gradient(135deg, #0D0B18 0%, #1F1135 100%)' }} />

      {/* ── Floating background orbs ── */}
      <AbsoluteFill style={{ overflow: 'hidden', zIndex: 1 }}>
        <Orb x={3} y={10}  size={180} color={pc.glow} delay={0}  speed={1} />
        <Orb x={88} y={5}  size={140} color="rgba(109,40,217,0.3)" delay={5}  speed={0.8} />
        <Orb x={2}  y={75} size={120} color="rgba(14,165,233,0.2)" delay={10} speed={1.2} />
        <Orb x={90} y={80} size={160} color={pc.glow} delay={3}  speed={0.9} />
      </AbsoluteFill>

      {/* ── Glow burst flash on scene entry ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
        background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${pc.glow}, transparent 70%)`,
        opacity: burstOpacity,
      }} />

      {/* ── Browser frame with entrance animation ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        transform: `translateY(${frameY}px)`,
        opacity: frameOpacity,
      }}>
        {/* Aura glow ring behind frame */}
        <div style={{
          position: 'absolute',
          top: `calc(5% - ${auraSize}px)`,
          left: `calc(5% - ${auraSize}px)`,
          width: `calc(90% + ${auraSize * 2}px)`,
          height: `calc(90% + ${auraSize * 2}px)`,
          borderRadius: 20,
          boxShadow: `0 0 40px 12px ${pc.glow}`,
          opacity: auraOpacity,
          pointerEvents: 'none',
          zIndex: 9,
        }} />

        <BrowserFrame scale={0.88} glow={0.3}>
          <div style={{
            width: '100%', height: '100%',
            transform: `scale(${scale}) translate(${panX}%, ${panY}%)`,
            transformOrigin: '50% 30%',
            transition: 'none',
          }}>
            {screenshot ? (
              <Img
                src={staticFile(`captures/${screenshot}`)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                {children}
              </div>
            )}
          </div>

          {/* ── Scan line ── */}
          <div style={{
            position: 'absolute', left: 0, right: 0,
            top: `${scanY}%`, height: 2,
            background: `linear-gradient(90deg, transparent, ${pc.bg}cc, transparent)`,
            opacity: scanOpacity, pointerEvents: 'none', zIndex: 30,
          }} />
        </BrowserFrame>
      </div>

      {/* ── Dark gradient at bottom so text stays readable ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 240,
        background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.40) 55%, transparent 100%)',
        zIndex: 20, pointerEvents: 'none',
      }} />

      {/* ── Portal badge + label — bottom left ── */}
      <div style={{
        position: 'absolute', bottom: 56, left: 80, zIndex: 50,
        display: 'flex', flexDirection: 'column', gap: 10,
        opacity: labelOpacity, transform: `translateY(${labelY}px)`,
      }}>
        <div style={{
          display: 'inline-flex', alignSelf: 'flex-start',
          padding: '5px 16px', borderRadius: 20,
          backgroundColor: pc.bg,
          fontFamily: interFont, fontSize: 13, fontWeight: 700,
          letterSpacing: '0.1em', color: pc.text,
          textTransform: 'uppercase',
          boxShadow: `0 0 20px ${pc.glow}, 0 0 40px ${pc.glow}`,
        }}>
          {pc.label}
        </div>
        <div style={{
          fontFamily: montserratFont, fontSize: 46, fontWeight: 800,
          color: '#ffffff', letterSpacing: '-0.5px',
          textShadow: `0 2px 32px rgba(0,0,0,0.8), 0 0 40px ${pc.glow}`,
          lineHeight: 1.1, maxWidth: 620,
        }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontFamily: interFont, fontSize: 20, color: '#cbd5e1', fontWeight: 500, textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}>
            {sublabel}
          </div>
        )}
      </div>

      {/* ── Callouts — bottom right ── */}
      {callouts.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 56, right: 80, zIndex: 50,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        }}>
          {callouts.map((c, i) => (
            <Callout key={i} text={c} index={i} totalFrames={durationInFrames} />
          ))}
        </div>
      )}

      {/* ── Neon accent line at bottom ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${pc.bg}, transparent)`,
        zIndex: 50,
        opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
        boxShadow: `0 0 12px ${pc.bg}`,
      }} />
    </AbsoluteFill>
  );
};
