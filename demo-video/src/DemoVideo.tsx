import { AbsoluteFill, Sequence, useVideoConfig, useCurrentFrame, Img, Audio, staticFile, interpolate, spring } from 'remotion';
import React from 'react';
import { loadFont } from '@remotion/google-fonts/Inter';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();
const { fontFamily: montserratFont } = loadMontserrat();

interface DemoVideoProps {
  aspectRatio: '16:9' | '9:16';
}

export const DemoVideo: React.FC<DemoVideoProps> = ({ aspectRatio }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isVertical = aspectRatio === '9:16';

  // Helper to animate captions with a nice spring entry
  const renderCaption = (text: string, fromFrame: number, duration: number) => {
    const activeFrame = frame - fromFrame;
    if (activeFrame < 0 || activeFrame > duration) return null;
    
    // Fade in
    const opacity = interpolate(activeFrame, [0, 15], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    
    // Scale spring
    const scale = spring({
      frame: activeFrame,
      fps,
      config: { damping: 15, mass: 0.5 },
    });

    return (
      <div style={{
        position: 'absolute',
        bottom: isVertical ? 250 : 100,
        left: '50%',
        transform: `translateX(-50%) scale(${scale})`,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        backdropFilter: 'blur(8px)',
        color: '#ffffff',
        padding: isVertical ? '24px 36px' : '16px 32px',
        borderRadius: '20px',
        fontSize: isVertical ? '30px' : '22px',
        fontFamily,
        fontWeight: 600,
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        opacity,
        width: isVertical ? '85%' : 'auto',
        maxWidth: '90%',
        zIndex: 100
      }}>
        {text}
      </div>
    );
  };

  // Zoom and pan logic for screenshots
  const getCameraStyle = (fromFrame: number, durationInFrames: number) => {
    const activeFrame = frame - fromFrame;
    
    // Continuous slow zoom in
    const scale = interpolate(activeFrame, [0, durationInFrames], [1.02, 1.12], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    // Subtle translation
    const translateY = interpolate(activeFrame, [0, durationInFrames], [0, isVertical ? -50 : -20], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return {
      transform: `scale(${scale}) translateY(${translateY}px)`,
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
      transformOrigin: 'center center'
    };
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#090d16', overflow: 'hidden' }}>
      {/* Background Music - loops or plays throughout */}
      <Audio src={staticFile('audio/background.mp3')} volume={0.15} />

      {/* Voiceover Track */}
      <Sequence from={0}>
        <Audio src={staticFile('audio/scene1.m4a')} />
      </Sequence>
      <Sequence from={150}>
        <Audio src={staticFile('audio/scene2.m4a')} />
      </Sequence>
      <Sequence from={450}>
        <Audio src={staticFile('audio/scene3.m4a')} />
      </Sequence>
      <Sequence from={750}>
        <Audio src={staticFile('audio/scene4.m4a')} />
      </Sequence>
      <Sequence from={1200}>
        <Audio src={staticFile('audio/scene5.m4a')} />
      </Sequence>
      <Sequence from={1500}>
        <Audio src={staticFile('audio/scene6.m4a')} />
      </Sequence>

      {/* Scene 1: Welcome Intro Splash (0 - 5s, frames 0 - 150) */}
      <Sequence from={0} durationInFrames={150}>
        <AbsoluteFill style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'radial-gradient(circle at center, #1e1b4b 0%, #030712 100%)'
        }}>
          {/* Logo animation */}
          <div style={{
            fontSize: isVertical ? '80px' : '64px',
            fontFamily: montserratFont,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-2px',
            marginBottom: '16px',
            textShadow: '0 0 40px rgba(231,118,46,0.3)'
          }}>
            AlgoLend<span style={{ color: '#E7762E' }}>.</span>
          </div>
          
          <div style={{
            fontSize: isVertical ? '32px' : '24px',
            fontFamily,
            fontWeight: 500,
            color: '#9ca3af',
            letterSpacing: '1px'
          }}>
            Bespoke Credit & Risk Management
          </div>

          {/* Accent decoration */}
          <div style={{
            marginTop: '32px',
            width: '80px',
            height: '4px',
            borderRadius: '2px',
            backgroundColor: '#E7762E'
          }} />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Calculator Screen (5 - 15s, frames 150 - 450) */}
      <Sequence from={150} durationInFrames={300}>
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img src={staticFile('captures/scene2-calc.png')} style={getCameraStyle(150, 300)} />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Client Onboarding (15 - 25s, frames 450 - 750) */}
      <Sequence from={450} durationInFrames={300}>
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img src={staticFile('captures/scene3-apply1.png')} style={getCameraStyle(450, 300)} />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Admin Queue (25 - 40s, frames 750 - 1200) */}
      <Sequence from={750} durationInFrames={450}>
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img src={staticFile('captures/scene4-queue.png')} style={getCameraStyle(750, 450)} />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 5: Loan Approval & Cash Ledger (40 - 50s, frames 1200 - 1500) */}
      <Sequence from={1200} durationInFrames={300}>
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img src={staticFile('captures/scene5-detail.png')} style={getCameraStyle(1200, 300)} />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 6: Outro (50 - 60s, frames 1500 - 1800) */}
      <Sequence from={1500} durationInFrames={300}>
        <AbsoluteFill style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'radial-gradient(circle at center, #020617 0%, #090d16 100%)'
        }}>
          <div style={{
            fontSize: isVertical ? '72px' : '54px',
            fontFamily: montserratFont,
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: '20px'
          }}>
            AlgoLend
          </div>
          
          <div style={{
            fontSize: isVertical ? '32px' : '22px',
            fontFamily,
            fontWeight: 500,
            color: '#E7762E',
            marginBottom: '48px',
            letterSpacing: '0.5px'
          }}>
            Empower Your Lending Operations
          </div>

          <div style={{
            padding: isVertical ? '18px 36px' : '14px 28px',
            backgroundColor: '#E7762E',
            color: '#ffffff',
            borderRadius: '40px',
            fontWeight: 700,
            fontSize: isVertical ? '32px' : '20px',
            fontFamily,
            boxShadow: '0 10px 30px rgba(231,118,46,0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            algolend.co.za
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Synchronized Subtitles / Captions */}
      {renderCaption("AlgoLend: Bespoke Digital Credit & Risk Management", 0, 150)}
      {renderCaption("Interactive loan calculations with transparent interest and fee breakdowns", 150, 300)}
      {renderCaption("Automated client onboarding, bank verification, and document upload", 450, 300)}
      {renderCaption("Real-time administrator application queuing and credit bureau reports", 750, 450)}
      {renderCaption("One-click approvals with live cash ledgers and transactional auditing", 1200, 300)}
      {renderCaption("Streamline your loan origination process at algolend.co.za", 1500, 300)}
    </AbsoluteFill>
  );
};
