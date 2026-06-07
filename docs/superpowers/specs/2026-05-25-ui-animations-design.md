# UI Animations Implementation Specification

This document details the visual and functional specifications for integrating comprehensive UI animations into the Zwane Official Admin Portal. The goal is to elevate the user experience with fluid, premium motion that is responsive, modern, and visually impressive.

## 1. Core Transitions & Feeds

### 1.1 Toast Alert Animations
*   **Target File**: `public/admin/src/styles.css`
*   **Behavior**: Currently, the toast system in `layout.js` uses the class `animate-fade-in-up`, but it lacks CSS rules. We will define a keyframe animation that translates the toast container along the Y-axis (+1.5rem to 0) while scaling from 0.95 to 1.
*   **Specification**:
    ```css
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(1.5rem) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    .animate-fade-in-up {
      animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    ```

### 1.2 Page/Module Loading Entry Animations
*   **Target File**: `public/admin/src/styles.css`
*   **Behavior**: Admin views (Users directory, Applications, Settings, etc.) use the `animate-fade-in` class. We will define this class with a smooth fade-in and subtle slide-up (+8px to 0) to avoid jarring instant loading jumps.
*   **Specification**:
    ```css
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .animate-fade-in {
      animation: fadeIn 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }
    ```

### 1.3 Mobile Sidebar Overlay Blur
*   **Target File**: `public/admin/src/shared/layout.js` & `public/admin/src/styles.css`
*   **Behavior**: Toggling the mobile sidebar currently flips `hidden` on the `#sidebar-overlay` element. We will replace this with transitioning classes (`opacity-0 pointer-events-none` vs `opacity-100 pointer-events-auto`) along with `transition-all duration-300` and backdrop blur to create a premium glassmorphic overlay fade.

---

## 2. Accordion Nav Submenus
*   **Target File**: `public/admin/src/shared/layout.js` & `public/admin/src/styles.css`
*   **Behavior**: Submenus (Payments & Analytics) in the sidebar toggle the `hidden` class instantly. We will implement CSS-driven height transition.
*   **Specification**:
    *   JS code will toggle `expanded` class on submenus instead of `hidden`.
    *   CSS classes:
        ```css
        .nav-submenu {
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease-out;
        }
        .nav-submenu.expanded {
          max-height: 160px;
          opacity: 1;
        }
        ```

---

## 3. Micro-interactions & Tactile States

### 3.1 Button Interactive Feedback
*   **Target File**: `public/admin/src/styles.css`
*   **Behavior**: Buttons in the portal should respond to cursor clicks with a minor physical scale down, providing tactile feedback.
*   **Specification**:
    ```css
    button:active, .btn:active, .sign-out-btn:active {
      transform: scale(0.97);
      transition: transform 0.1s ease;
    }
    ```

### 3.2 Shimmer Loader Skeletons
*   **Target File**: `public/admin/src/styles.css`
*   **Behavior**: Introduce a utility `.shimmer-bg` class representing page layout elements when performing async database queries.
*   **Specification**:
    ```css
    @keyframes shimmer {
      100% { transform: translateX(100%); }
    }
    .shimmer-bg {
      position: relative;
      overflow: hidden;
      background-color: var(--color-surface-container);
    }
    .shimmer-bg::after {
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background-image: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.15) 20%,
        rgba(255, 255, 255, 0.4) 60%,
        rgba(255, 255, 255, 0) 100%
      );
      animation: shimmer 1.5s infinite;
      content: '';
    }
    ```

---

## 4. Verification Plan
*   **Build/Compile Check**: Run `npm run build` in `public/admin` to verify that assets build cleanly without CSS post-processing or Vite compile issues.
*   **Visual Test**: Manually verify:
    1.  Toast alerts when triggering success alerts.
    2.  Responsive sidebar menu and backdrop fade on mobile screen viewport widths.
    3.  Accordion slide animation of "Payments" and "Analytics" submenus in the sidebar.
    4.  Visual transition when navigating between modules.
