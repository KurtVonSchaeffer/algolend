# AlgoLend Demo Video Production Specification

This document details the visual, functional, and architectural specification for creating an automated, high-quality end-to-end demo video of the AlgoLend application using **Remotion** and **Playwright**.

## User Review Required

> [!IMPORTANT]
> The automated capture script (`scripts/capture-demo.js`) will run using a **Fail-Safe Mock Mode** by default. This intercepts network requests and simulates successful DB responses. This means the script will execute successfully even if local Supabase tables are empty or if external API keys (TruID, Experian) are not set.

## Proposed Changes

### Video Production Component

We will introduce a browser automation capture script and a Remotion project to compile the screenshots into finished videos.

---

#### [NEW] [capture-demo.js](file:///Users/kurtvonschaeffer/Algolend/scripts/capture-demo.js)
A script to orchestrate local server startup, automate navigation, and capture screenshots of both user and admin portals.

*   Launches Playwright headless browser at 2x device scale for high DPI screenshots.
*   Intercepts `/api/*` and Supabase client calls to inject mock data (e.g. approved loans, Experian credit check reports, cash ledger ledger lines).
*   Saves screenshots directly to the Remotion public captures directory.

#### [NEW] [demo-video/package.json](file:///Users/kurtvonschaeffer/Algolend/demo-video/package.json)
Remotion video dependencies.
*   Includes `remotion`, `@remotion/cli`, `@remotion/media`, `@remotion/google-fonts`.

#### [NEW] [demo-video/src/Root.tsx](file:///Users/kurtvonschaeffer/Algolend/demo-video/src/Root.tsx)
Declares the two video compositions:
*   `WidescreenDemo`: 1920x1080 resolution, 30 fps, 1800 frames (60 seconds).
*   `VerticalDemo`: 1080x1920 resolution, 30 fps, 1800 frames (60 seconds).

#### [NEW] [demo-video/src/DemoVideo.tsx](file:///Users/kurtvonschaeffer/Algolend/demo-video/src/DemoVideo.tsx)
The core React composition component.
*   Coordinates the 6 scenes using `<Sequence>`.
*   Uses `interpolate()` to animate camera movement (CSS transform scales and translations) over the captured screenshots.
*   Renders animated captions and modern glassmorphic overlays.
*   Incorporates background music.

---

## Verification Plan

### Automated Tests
*   Run `node scripts/capture-demo.js` to verify screenshots are correctly captured and saved.
*   Run `npx remotion preview` inside the `demo-video` directory to verify the video plays correctly in Remotion Studio.
*   Run the Remotion build commands to verify both videos render successfully:
    ```bash
    npx remotion render WidescreenDemo out/widescreen.mp4
    npx remotion render VerticalDemo out/vertical.mp4
    ```

### Manual Verification
*   Open the rendered videos (`out/widescreen.mp4` and `out/vertical.mp4`) in a media player to inspect for layout, aspect ratios, readability of text overlays, and audio sync.
