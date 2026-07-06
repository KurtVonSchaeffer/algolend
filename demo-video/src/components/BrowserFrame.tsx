import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export const BrowserFrame: React.FC<{
  children: React.ReactNode;
  scale?: number;
  glow?: number;
}> = ({ children, scale = 1, glow = 0 }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{
      position: 'absolute',
      top: '5%',
      left: '5%',
      width: '90%',
      height: '90%',
      transform: `scale(${scale})`,
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: '#0f172a',
      boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 ${20 + glow * 40}px rgba(139, 92, 246, ${0.2 + glow * 0.3})`,
      border: '1px solid rgba(255, 255, 255, 0.1)',
      zIndex: 10
    }}>
      {/* Top Bar */}
      <div style={{
        height: 40,
        backgroundColor: '#1e293b',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 8
      }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10b981' }} />
        <div style={{
          marginLeft: 20,
          backgroundColor: '#0f172a',
          borderRadius: 6,
          height: 24,
          flex: 1,
          maxWidth: 400,
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontSize: 12,
          fontFamily: 'Inter, sans-serif'
        }}>
          app.algolend.com
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};
