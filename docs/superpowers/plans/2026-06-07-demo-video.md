# AlgoLend Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Playwright capture script and a Remotion project to compile widescreen and vertical demo videos of the end-to-end user application and admin approval workflows.

**Architecture:** Playwright launches a headless browser and uses mock intercepts to step through the frontend pages, capturing 2x DPI screenshots. A Remotion project then renders the screenshots sequentially with zoom/pan animations, text overlays, and audio.

**Tech Stack:** Playwright, React, Remotion, Express, Supabase JS client.

---

### Task 1: Playwright Capture Automation Script

**Files:**
- Create: `scripts/capture-demo.js`

- [ ] **Step 1: Write capture-demo.js**
  Write a Node.js script using Playwright to launch a browser, set a 1920x1080 viewport, load local frontend pages, inject mock data, and save screenshots of key screens.
  
  ```javascript
  const { chromium } = require('playwright');
  const path = require('path');
  const fs = require('fs');

  async function captureScreenshots() {
    const browser = await chromium.launch({ headless: true });
    // Use 2x device scale factor for sharp text/assets
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    const outputDir = path.join(__dirname, '../demo-video/public/captures');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('Starting automated screenshot captures...');

    // 1. Calculator Screen
    await page.goto('http://localhost:5000/user-portal/loan-calculator.html');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'scene2-calc.png') });

    // 2. Client Application Details
    await page.goto('http://localhost:5000/user-portal/pages/apply-loan.html');
    await page.waitForTimeout(1000);
    // Fill in mock inputs
    await page.fill('#first_name', 'John');
    await page.fill('#last_name', 'Doe');
    await page.fill('#id_number', '9001015000081');
    await page.fill('#email', 'john.doe@example.com');
    await page.screenshot({ path: path.join(outputDir, 'scene3-apply1.png') });

    // 3. Bank Verification Screen
    await page.goto('http://localhost:5000/user-portal/pages/apply-loan-2.html');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'scene3-apply2.png') });

    // 4. Client Dashboard Screen
    await page.goto('http://localhost:5000/user-portal/pages/dashboard.html');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'scene3-dashboard.png') });

    // 5. Admin Portal Login
    await page.goto('http://localhost:5000/auth/login.html');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'scene4-login.png') });

    // 6. Admin Dashboard Applications Queue
    await page.goto('http://localhost:5000/admin/dashboard.html');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'scene4-queue.png') });

    // 7. Admin Application Detail
    await page.goto('http://localhost:5000/admin/application-detail.html');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'scene5-detail.png') });

    // 8. Admin Cash Ledger
    await page.goto('http://localhost:5000/admin/cash-ledger.html');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'scene5-ledger.png') });

    await browser.close();
    console.log('Screenshots captured successfully!');
  }

  captureScreenshots().catch(err => {
    console.error('Capture failed:', err);
    process.exit(1);
  });
  ```

- [ ] **Step 2: Commit capture script**
  ```bash
  git add scripts/capture-demo.js
  git commit -m "feat: add playwright screenshot capture script"
  ```

---

### Task 2: Remotion Project Scaffolding

**Files:**
- Create: `demo-video/package.json`
- Create: `demo-video/src/index.ts`

- [ ] **Step 1: Write package.json**
  ```json
  {
    "name": "algolend-demo-video",
    "version": "1.0.0",
    "description": "Remotion video project for AlgoLend",
    "scripts": {
      "start": "remotion studio",
      "build:widescreen": "remotion render WidescreenDemo out/widescreen.mp4",
      "build:vertical": "remotion render VerticalDemo out/vertical.mp4"
    },
    "dependencies": {
      "@remotion/cli": "^4.0.140",
      "@remotion/google-fonts": "^4.0.140",
      "@remotion/media": "^4.0.140",
      "react": "^18.2.0",
      "react-dom": "^18.2.0",
      "remotion": "^4.0.140"
    },
    "devDependencies": {
      "@types/react": "^18.2.0",
      "typescript": "^5.0.4"
    }
  }
  ```

- [ ] **Step 2: Write src/index.ts**
  ```typescript
  import { registerRoot } from 'remotion';
  import { RemotionRoot } from './Root';

  registerRoot(RemotionRoot);
  ```

- [ ] **Step 3: Commit setup files**
  ```bash
  git add demo-video/package.json demo-video/src/index.ts
  git commit -m "chore: scaffold remotion project config"
  ```

---

### Task 3: Remotion Root Configuration

**Files:**
- Create: `demo-video/src/Root.tsx`

- [ ] **Step 1: Write Root.tsx**
  Configure the root compositions for both widescreen (16:9) and vertical (9:16) formats.
  
  ```tsx
  import { Composition } from 'remotion';
  import { DemoVideo } from './DemoVideo';

  export const RemotionRoot = () => {
    return (
      <>
        <Composition
          id="WidescreenDemo"
          component={DemoVideo}
          durationInFrames={1800} // 60 seconds @ 30fps
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            aspectRatio: '16:9'
          }}
        />
        <Composition
          id="VerticalDemo"
          component={DemoVideo}
          durationInFrames={1800} // 60 seconds @ 30fps
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{
            aspectRatio: '9:16'
          }}
        />
      </>
    );
  };
  ```

- [ ] **Step 2: Commit root**
  ```bash
  git add demo-video/src/Root.tsx
  git commit -m "feat: configure widescreen and vertical remotion compositions"
  ```

---

### Task 4: Video Sequence and Overlay Code

**Files:**
- Create: `demo-video/src/DemoVideo.tsx`

- [ ] **Step 1: Write DemoVideo.tsx**
  Implement the React Remotion structure animating screenshots with zoom, pan, modern caption bubbles, and background audio.
  
  ```tsx
  import { AbsoluteFill, Sequence, useVideoConfig, useCurrentFrame, Img, Audio, staticFile, interpolate, spring } from 'remotion';
  import React from 'react';

  interface DemoVideoProps {
    aspectRatio: '16:9' | '9:16';
  }

  export const DemoVideo: React.FC<DemoVideoProps> = ({ aspectRatio }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isVertical = aspectRatio === '9:16';

    // Helper to animate captions
    const renderCaption = (text: string, fromFrame: number, duration: number) => {
      const activeFrame = frame - fromFrame;
      if (activeFrame < 0 || activeFrame > duration) return null;
      const opacity = spring({ frame: activeFrame, fps, config: { damping: 12 } });
      
      return (
        <div style={{
          position: 'absolute',
          bottom: isVertical ? 250 : 80,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(23, 23, 23, 0.85)',
          backdropFilter: 'blur(8px)',
          color: '#ffffff',
          padding: '16px 28px',
          borderRadius: '16px',
          fontSize: isVertical ? '32px' : '22px',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 600,
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          opacity,
          width: isVertical ? '80%' : 'auto',
          maxWidth: '90%',
          zIndex: 100
        }}>
          {text}
        </div>
      );
    };

    // Camera zooms/pans
    const getZoomStyle = (fromFrame: number, duration: number, zoomScale: number = 1.1) => {
      const activeFrame = frame - fromFrame;
      const scale = interpolate(activeFrame, [0, duration], [1, zoomScale], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return {
        transform: `scale(${scale})`,
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const
      };
    };

    return (
      <AbsoluteFill style={{ backgroundColor: '#111827', overflow: 'hidden' }}>
        {/* Background Music */}
        <Audio src={staticFile('audio/background.mp3')} volume={0.25} />

        {/* Scene 1: Welcome Intro Splash (0 - 5s) */}
        <Sequence from={0} durationInFrames={150}>
          <AbsoluteFill style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'radial-gradient(circle, #2e1065 0%, #0f172a 100%)'
          }}>
            <h1 style={{
              color: '#ffffff',
              fontSize: isVertical ? '64px' : '54px',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              marginBottom: '16px'
            }}>AlgoLend</h1>
            <p style={{
              color: '#e7762e',
              fontSize: isVertical ? '32px' : '24px',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 500
            }}>Bespoke Credit & Risk Platform</p>
          </AbsoluteFill>
        </Sequence>

        {/* Scene 2: Calculator (5 - 15s) */}
        <Sequence from={150} durationInFrames={300}>
          <AbsoluteFill style={{ overflow: 'hidden' }}>
            <Img src={staticFile('captures/scene2-calc.png')} style={getZoomStyle(150, 300, 1.15)} />
          </AbsoluteFill>
        </Sequence>

        {/* Scene 3: Client Onboarding (15 - 25s) */}
        <Sequence from={450} durationInFrames={300}>
          <AbsoluteFill style={{ overflow: 'hidden' }}>
            <Img src={staticFile('captures/scene3-apply1.png')} style={getZoomStyle(450, 300, 1.1)} />
          </AbsoluteFill>
        </Sequence>

        {/* Scene 4: Admin Queue (25 - 40s) */}
        <Sequence from={750} durationInFrames={450}>
          <AbsoluteFill style={{ overflow: 'hidden' }}>
            <Img src={staticFile('captures/scene4-queue.png')} style={getZoomStyle(750, 450, 1.12)} />
          </AbsoluteFill>
        </Sequence>

        {/* Scene 5: Loan Approval (40 - 50s) */}
        <Sequence from={1200} durationInFrames={300}>
          <AbsoluteFill style={{ overflow: 'hidden' }}>
            <Img src={staticFile('captures/scene5-detail.png')} style={getZoomStyle(1200, 300, 1.1)} />
          </AbsoluteFill>
        </Sequence>

        {/* Scene 6: Outro Conclusion (50 - 60s) */}
        <Sequence from={1500} durationInFrames={300}>
          <AbsoluteFill style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'radial-gradient(circle, #0f172a 0%, #020617 100%)'
          }}>
            <h1 style={{
              color: '#ffffff',
              fontSize: isVertical ? '54px' : '48px',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 800,
              marginBottom: '24px'
            }}>AlgoLend</h1>
            <p style={{
              color: '#e7762e',
              fontSize: isVertical ? '32px' : '22px',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 500,
              marginBottom: '40px'
            }}>Empower Your Lending Operations</p>
            <div style={{
              padding: '12px 24px',
              backgroundColor: '#e7762e',
              color: '#ffffff',
              borderRadius: '30px',
              fontWeight: 700,
              fontSize: isVertical ? '28px' : '18px',
              fontFamily: 'system-ui, sans-serif'
            }}>algolend.co.za</div>
          </AbsoluteFill>
        </Sequence>

        {/* Captions Overlay */}
        {renderCaption("AlgoLend: Bespoke Digital Credit & Risk Management", 0, 150)}
        {renderCaption("Interactive loan calculations with transparent interest and fee breakdowns", 150, 300)}
        {renderCaption("Automated client onboarding, bank verification, and document upload", 450, 300)}
        {renderCaption("Real-time administrator application queuing and credit reports", 750, 450)}
        {renderCaption("One-click approvals with live cash ledgers and transactional auditing", 1200, 300)}
        {renderCaption("Streamline your loan origination process at algolend.co.za", 1500, 300)}
      </AbsoluteFill>
    );
  };
  ```

- [ ] **Step 2: Commit overlays and sequences**
  ```bash
  git add demo-video/src/DemoVideo.tsx
  git commit -m "feat: implement main video sequences, animations, and subtitles"
  ```

---

### Task 5: Setup Music Asset & Run Browser Capture

**Files:**
- Create: `demo-video/public/audio/background.mp3`

- [ ] **Step 1: Place background track**
  Create a placeholder/generate background music in `demo-video/public/audio/background.mp3`.
  
- [ ] **Step 2: Run capture script**
  Run the Playwright script to capture actual screenshots of pages.
  Run: `node scripts/capture-demo.js`
  Expected: Screenshots saved to `demo-video/public/captures/` folder.

- [ ] **Step 3: Commit captured assets**
  ```bash
  git add demo-video/public/captures/*.png
  git commit -m "feat: add automated screen captures"
  ```

---

### Task 6: Render Final Videos

- [ ] **Step 1: Install packages**
  Run: `npm install` inside the `demo-video` directory.

- [ ] **Step 2: Render widescreen video**
  Run: `npm run build:widescreen`
  Expected: Output `demo-video/out/widescreen.mp4` successfully compiled.

- [ ] **Step 3: Render vertical video**
  Run: `npm run build:vertical`
  Expected: Output `demo-video/out/vertical.mp4` successfully compiled.

---
