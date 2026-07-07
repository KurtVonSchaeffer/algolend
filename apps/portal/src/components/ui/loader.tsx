interface LoaderProps {
  /** Pixel size of the spinner (default 200) */
  size?: number;
}

/**
 * Brand loader — gooey ring spinner with the AlgoLend purple gradient.
 * Colours come from the theme CSS variables so admin theme changes apply.
 */
export function Loader({ size = 200 }: LoaderProps) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <style>{`
        .brand-loader-snurra { filter: url(#brand-loader-goo); }
        .brand-loader-stop1 { stop-color: var(--color-primary-soft, #A78BFA); }
        .brand-loader-stop2 { stop-color: var(--color-primary-strong, #5B21B6); }
        .brand-loader-halvan {
          animation: brandLoaderSpin 10s infinite linear;
          stroke-dasharray: 180 800;
          fill: none;
          stroke: url(#brand-loader-gradient);
          stroke-width: 23;
          stroke-linecap: round;
        }
        .brand-loader-strecken {
          animation: brandLoaderSpin 3s infinite linear;
          stroke-dasharray: 26 54;
          fill: none;
          stroke: url(#brand-loader-gradient);
          stroke-width: 23;
          stroke-linecap: round;
        }
        .brand-loader-skugga {
          filter: blur(5px);
          opacity: 0.3;
          position: absolute;
          inset: 0;
          transform: translate(3px, 3px);
        }
        @keyframes brandLoaderSpin {
          0%   { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -403px; }
        }
      `}</style>

      {/* Gooey filter + gradient defs (zero-size svg) */}
      <svg style={{ width: 0, height: 0, position: 'absolute' }}>
        <defs>
          <filter id="brand-loader-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation={7} result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
          <linearGradient id="brand-loader-stops">
            <stop className="brand-loader-stop1" offset={0} />
            <stop className="brand-loader-stop2" offset={1} />
          </linearGradient>
          <linearGradient
            id="brand-loader-gradient"
            x1={40} y1={40} x2={160} y2={160}
            gradientUnits="userSpaceOnUse"
            href="#brand-loader-stops"
          />
        </defs>
      </svg>

      {/* Soft shadow copy behind */}
      <svg className="brand-loader-skugga" width={size} height={size} viewBox="0 0 200 200">
        <path
          className="brand-loader-halvan"
          d="m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622,0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64"
        />
        <circle className="brand-loader-strecken" cx={100} cy={100} r={64} />
      </svg>

      {/* Main spinner */}
      <svg className="brand-loader-snurra" width={size} height={size} viewBox="0 0 200 200" style={{ position: 'relative' }}>
        <path
          className="brand-loader-halvan"
          d="m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622,0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64"
        />
        <circle className="brand-loader-strecken" cx={100} cy={100} r={64} />
      </svg>
    </div>
  );
}

export default Loader;
