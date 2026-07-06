import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { IntroGraphic } from './components/IntroGraphic';
import { SceneSlide } from './components/SceneSlide';

const { fontFamily: interFont } = loadFont();
const { fontFamily: montserratFont } = loadMontserrat();

// ─── Frame budget @ 30fps ───────────────────────────────────────────────────
//  Scene             | frames | seconds
//  Intro             |    60  |  2.0
//  Section: Client   |    45  |  1.5
//  Login             |   120  |  4.0
//  User Dashboard    |   120  |  4.0
//  Apply for Loan    |   120  |  4.0
//  Loan Calculator   |   120  |  4.0
//  Documents         |    90  |  3.0
//  User Profile      |    90  |  3.0
//  Section: Admin    |    45  |  1.5
//  Admin Dashboard   |   150  |  5.0
//  Applications      |   120  |  4.0
//  App Detail        |   120  |  4.0
//  Loan Book         |   120  |  4.0
//  Credit Rules      |   120  |  4.0
//  Users             |    90  |  3.0
//  Cash Ledger       |   120  |  4.0
//  Incoming Payments |   120  |  4.0
//  Outgoing Payments |    90  |  3.0
//  Settings          |    90  |  3.0
//  Outro             |    90  |  3.0
//  ──────────────────────────────────
//  TOTAL             |  2040  |  68.0s  (1 min 8 sec)

let cursor = 0;
const t = (n: number) => { const s = cursor; cursor += n; return s; };

const F_INTRO              = t(60);
const F_SECTION_CLIENT     = t(45);
const F_LOGIN              = t(120);
const F_USER_DASHBOARD     = t(120);
const F_USER_APPLY         = t(120);
const F_USER_CALC          = t(120);
const F_USER_DOCS          = t(90);
const F_USER_PROFILE       = t(90);
const F_SECTION_ADMIN      = t(45);
const F_ADMIN_DASHBOARD    = t(150);
const F_ADMIN_APPS         = t(120);
const F_ADMIN_APP_DETAIL   = t(120);
const F_ADMIN_LOAN_BOOK    = t(120);
const F_ADMIN_CREDIT_RULES = t(120);
const F_ADMIN_USERS        = t(90);
const F_ADMIN_LEDGER       = t(120);
const F_ADMIN_INCOMING     = t(120);
const F_ADMIN_OUTGOING     = t(90);
const F_ADMIN_SETTINGS     = t(90);
const F_OUTRO              = t(90);
export const TOTAL_FRAMES  = cursor; // 2040

// ─── Section title card ──────────────────────────────────────────────────────
const SectionCard: React.FC<{ title: string; subtitle: string; accent: string }> = ({ title, subtitle, accent }) => {
  const frame = useCurrentFrame();
  const progress = spring({ frame, fps: 30, config: { damping: 20, mass: 0.6 } });
  const opacity  = interpolate(progress, [0, 1], [0, 1], { extrapolateRight: 'clamp' });
  const y        = interpolate(progress, [0, 1], [40, 0], { extrapolateRight: 'clamp' });
  const { durationInFrames } = useVideoConfig();
  const exitOpacity = interpolate(frame, [durationInFrames - 14, durationInFrames - 2], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #0D0B18 0%, #1F1135 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: opacity * exitOpacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div style={{
        width: 72, height: 4, borderRadius: 2,
        background: `linear-gradient(90deg, ${accent}, transparent)`,
        marginBottom: 28,
        boxShadow: `0 0 18px ${accent}99`,
      }} />
      <div style={{
        fontFamily: montserratFont, fontSize: 64, fontWeight: 900,
        color: '#ffffff', letterSpacing: '-1px', marginBottom: 16,
        textShadow: `0 0 40px ${accent}66`,
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: interFont, fontSize: 22, fontWeight: 500,
        color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {subtitle}
      </div>
      <div style={{
        width: 72, height: 4, borderRadius: 2,
        background: `linear-gradient(270deg, ${accent}, transparent)`,
        marginTop: 28,
        boxShadow: `0 0 18px ${accent}99`,
      }} />
    </AbsoluteFill>
  );
};

// ─── Outro brand card ─────────────────────────────────────────────────────────
const OutroCard: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = spring({ frame: frame - 10, fps: 30, config: { damping: 18, mass: 0.7 } });
  const logoPop = interpolate(logoScale, [0, 1], [0.5, 1], { extrapolateRight: 'clamp' });
  const textFade = interpolate(frame, [24, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0D0B18 0%, #1F1135 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        opacity: fadeIn,
      }}
    >
      <div style={{ transform: `scale(${logoPop})`, marginBottom: 32 }}>
        <svg width="100" height="100" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#B026FF" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <path
            d="M 40 160 L 40 80 A 40 40 0 0 1 120 80 L 120 100"
            fill="transparent"
            stroke="url(#logo-grad)"
            strokeWidth="18"
            strokeLinecap="round"
          />
          <circle cx="80" cy="100" r="20" fill="#0D0B18" />
        </svg>
      </div>

      <div style={{ opacity: textFade, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontFamily: montserratFont, fontSize: 72, fontWeight: 900, color: '#fff', letterSpacing: '-1px', marginBottom: 16 }}>
          AlgoLend
        </div>
        <div style={{ fontFamily: interFont, fontSize: 20, color: '#94a3b8', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 48 }}>
          algolend.co.za
        </div>
        <div style={{
          display: 'flex', gap: 40,
          fontFamily: interFont, fontSize: 15, color: '#64748b',
          letterSpacing: '0.05em',
        }}>
          <span>Corporate Lending</span>
          <span style={{ color: '#B026FF' }}>•</span>
          <span>Risk & Compliance</span>
          <span style={{ color: '#B026FF' }}>•</span>
          <span>Portfolio Management</span>
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, transparent, #B026FF, #7c3aed, transparent)',
        opacity: textFade,
      }} />
    </AbsoluteFill>
  );
};

// ─── Main composition ─────────────────────────────────────────────────────────
export const DemoVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#0D0B18', overflow: 'hidden' }}>
    <Audio src={staticFile('audio/pinnacle.mp3')} volume={0.55} />

    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #0D0B18 0%, #1F1135 100%)' }} />

    {/* ── Intro splash ── */}
    <Sequence from={F_INTRO} durationInFrames={60}>
      <IntroGraphic />
    </Sequence>

    {/* ── CLIENT PORTAL section card ── */}
    <Sequence from={F_SECTION_CLIENT} durationInFrames={45}>
      <SectionCard title="Client Portal" subtitle="Borrower-facing application & self-service" accent="#0ea5e9" />
    </Sequence>

    {/* ── Login ── */}
    <Sequence from={F_LOGIN} durationInFrames={120}>
      <SceneSlide
        label="Secure Login"
        sublabel="Branded authentication with Supabase"
        portal="auth"
        screenshot="login.png"
        panFrom={[0, 0]} panTo={[0, 1.5]}
        callouts={['Multi-factor authentication', 'Instant session management', 'Role-based redirect']}
      />
    </Sequence>

    {/* ── User Dashboard ── */}
    <Sequence from={F_USER_DASHBOARD} durationInFrames={120}>
      <SceneSlide
        label="Client Dashboard"
        sublabel="Real-time portfolio overview"
        portal="user"
        screenshot="user-dashboard.png"
        panFrom={[0, 0]} panTo={[0.5, -0.5]}
        callouts={['Outstanding balance tracker', 'Next payment due date', 'Quick action shortcuts']}
      />
    </Sequence>

    {/* ── Apply for Loan ── */}
    <Sequence from={F_USER_APPLY} durationInFrames={120}>
      <SceneSlide
        label="Loan Application"
        sublabel="Guided multi-step application flow"
        portal="user"
        screenshot="user-apply.png"
        panFrom={[0, 0]} panTo={[-0.5, -1]}
        callouts={['Step-by-step guided flow', 'Document upload integration', 'Real-time eligibility check']}
      />
    </Sequence>

    {/* ── Loan Calculator ── */}
    <Sequence from={F_USER_CALC} durationInFrames={120}>
      <SceneSlide
        label="Loan Calculator"
        sublabel="Live repayment estimator"
        portal="user"
        screenshot="user-calculator.png"
        panFrom={[0.5, 0]} panTo={[-0.5, 0]}
        callouts={['Instant repayment breakdown', 'Interest & fee transparency', 'Multiple term scenarios']}
      />
    </Sequence>

    {/* ── Documents ── */}
    <Sequence from={F_USER_DOCS} durationInFrames={90}>
      <SceneSlide
        label="Document Centre"
        sublabel="Secure upload & verification hub"
        portal="user"
        screenshot="user-documents.png"
        panFrom={[0, 0]} panTo={[0, -1]}
        callouts={['Bank statements', 'Company registration docs', 'Verification status tracking']}
      />
    </Sequence>

    {/* ── User Profile ── */}
    <Sequence from={F_USER_PROFILE} durationInFrames={90}>
      <SceneSlide
        label="Client Profile"
        sublabel="KYC data & financial declarations"
        portal="user"
        screenshot="user-profile.png"
        panFrom={[0, 0]} panTo={[0.5, -0.5]}
        callouts={['Financial declarations', 'Identity & compliance data', 'Credit consent management']}
      />
    </Sequence>

    {/* ── ADMIN PORTAL section card ── */}
    <Sequence from={F_SECTION_ADMIN} durationInFrames={45}>
      <SectionCard title="Admin Portal" subtitle="Back-office risk, compliance & operations engine" accent="#B026FF" />
    </Sequence>

    {/* ── Admin Dashboard ── */}
    <Sequence from={F_ADMIN_DASHBOARD} durationInFrames={150}>
      <SceneSlide
        label="Operations Dashboard"
        sublabel="Live portfolio KPIs & activity feed"
        portal="admin"
        screenshot="admin-dashboard.png"
        panFrom={[0, 0]} panTo={[0.8, -0.8]}
        zoomStart={1.06} zoomEnd={1.0}
        callouts={['R 203.9K total revenue', '10 active loans live', 'Real-time cash flow charts', '5 applications pending review']}
      />
    </Sequence>

    {/* ── Applications Queue ── */}
    <Sequence from={F_ADMIN_APPS} durationInFrames={120}>
      <SceneSlide
        label="Applications Queue"
        sublabel="Review, approve & route loan applications"
        portal="admin"
        screenshot="admin-applications.png"
        panFrom={[0, 0]} panTo={[0, -1.5]}
        callouts={['Status-based workflow', 'Bureau score integration', 'One-click credit decision']}
      />
    </Sequence>

    {/* ── App Detail ── */}
    <Sequence from={F_ADMIN_APP_DETAIL} durationInFrames={120}>
      <SceneSlide
        label="Application Detail"
        sublabel="Full credit file & decisioning workspace"
        portal="admin"
        screenshot="admin-app-detail.png"
        panFrom={[0, 0]} panTo={[0.4, -1]}
        callouts={['Full financial profile', 'Credit bureau scores', 'Offer structuring tools']}
      />
    </Sequence>

    {/* ── Loan Book ── */}
    <Sequence from={F_ADMIN_LOAN_BOOK} durationInFrames={120}>
      <SceneSlide
        label="Loan Book"
        sublabel="Full portfolio tracking & arrears management"
        portal="admin"
        screenshot="admin-loan-book.png"
        panFrom={[0, 0]} panTo={[0, -1.5]}
        zoomStart={1.04} zoomEnd={1.0}
        callouts={['9 active loans — R 107,573 book value', 'In-arrears & default detection', 'Days active & maturity tracking']}
      />
    </Sequence>

    {/* ── Credit Rules ── */}
    <Sequence from={F_ADMIN_CREDIT_RULES} durationInFrames={120}>
      <SceneSlide
        label="Credit Rules Engine"
        sublabel="Configurable score bands & auto-decisions"
        portal="admin"
        screenshot="admin-credit-rules.png"
        panFrom={[0, 0]} panTo={[0.5, -0.8]}
        callouts={['5 risk bands (Excellent → Declined)', 'Auto-approve / review / decline', 'Rate & term configuration per band']}
      />
    </Sequence>

    {/* ── Users ── */}
    <Sequence from={F_ADMIN_USERS} durationInFrames={90}>
      <SceneSlide
        label="User Management"
        sublabel="Clients, staff & admin role control"
        portal="admin"
        screenshot="admin-users.png"
        panFrom={[0, 0]} panTo={[0, -1]}
        callouts={['Role-based access control', 'Branch staff assignment', 'Invite & onboard staff']}
      />
    </Sequence>

    {/* ── Cash Ledger ── */}
    <Sequence from={F_ADMIN_LEDGER} durationInFrames={120}>
      <SceneSlide
        label="Cash Ledger"
        sublabel="Daily cash flow journal & reconciliation"
        portal="admin"
        screenshot="admin-ledger.png"
        panFrom={[0, 0]} panTo={[0.5, 0]}
        callouts={['Read-only daily journal', 'Cash in / out / net position', 'Export & branch filtering']}
      />
    </Sequence>

    {/* ── Incoming Payments ── */}
    <Sequence from={F_ADMIN_INCOMING} durationInFrames={120}>
      <SceneSlide
        label="Incoming Payments"
        sublabel="EFT proofs, manual recording & recovery detail"
        portal="admin"
        screenshot="admin-incoming-payments.png"
        panFrom={[0, 0]} panTo={[0, -1]}
        callouts={['Manual payment proof upload', 'EFT reconciliation workflow', 'Recovery & profit analytics']}
      />
    </Sequence>

    {/* ── Outgoing Payments ── */}
    <Sequence from={F_ADMIN_OUTGOING} durationInFrames={90}>
      <SceneSlide
        label="Outgoing Payments"
        sublabel="Payout management & disbursement tracking"
        portal="admin"
        screenshot="admin-outgoing-payments.png"
        panFrom={[0, 0]} panTo={[0.5, -0.5]}
        callouts={['Payout approval workflow', 'Bank transfer & CashSend', 'Full disbursement audit trail']}
      />
    </Sequence>

    {/* ── Settings ── */}
    <Sequence from={F_ADMIN_SETTINGS} durationInFrames={90}>
      <SceneSlide
        label="Platform Settings"
        sublabel="Branding, NCR configuration & system controls"
        portal="admin"
        screenshot="admin-settings.png"
        panFrom={[0, 0]} panTo={[0, -1]}
        callouts={['Custom brand colours & logo', 'NCR & company registration', 'Auth flow & theme control']}
      />
    </Sequence>

    {/* ── Outro ── */}
    <Sequence from={F_OUTRO} durationInFrames={90}>
      <OutroCard />
    </Sequence>
  </AbsoluteFill>
);
