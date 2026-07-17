import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const LOAN_EXPLAINER_KEY = 'algolend_apply_explainer_seen';

const PANEL = {
  backdropFilter: 'blur(7px)',
  background: 'rgba(0,0,0,0.22)',
  position: 'fixed' as const,
  zIndex: 998,
  pointerEvents: 'auto' as const,
};

/* ── 4-panel single-hole overlay ── */
function SingleHoleOverlay({ hole, onClick }: { hole: { top: number; left: number; right: number; bottom: number; pad: number } | null; onClick: () => void }) {
  if (!hole) return (
    <motion.div style={{ ...PANEL, inset: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClick} />
  );
  const t = hole.top - hole.pad, l = hole.left - hole.pad;
  const r = hole.right + hole.pad, b = hole.bottom + hole.pad;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      style={{ position: 'fixed', inset: 0, zIndex: 998, pointerEvents: 'none' }}>
      <div style={{ ...PANEL, top: 0, left: 0, right: 0, height: t }} onClick={onClick} />
      <div style={{ ...PANEL, top: b, left: 0, right: 0, bottom: 0 }} onClick={onClick} />
      <div style={{ ...PANEL, top: t, left: 0, width: l, height: b - t }} onClick={onClick} />
      <div style={{ ...PANEL, top: t, left: r, right: 0, height: b - t }} onClick={onClick} />
    </motion.div>
  );
}

/* ── Pulsing ring ── */
function AnimatedRing({ rect, pad = 10, radius = 16, zIndex = 999 }: {
  rect: DOMRect | null; pad?: number; radius?: number; zIndex?: number;
}) {
  if (!rect) return null;
  return (
    <div className="pointer-events-none" style={{ position: 'fixed', top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, zIndex }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius, border: '2px solid rgba(255,255,255,0.90)', boxShadow: '0 0 18px 4px rgba(255,255,255,0.20)' }} />
      <motion.div style={{ position: 'absolute', inset: 0, borderRadius: radius, border: '1.5px solid rgba(255,255,255,0.60)' }}
        animate={{ opacity: [0.7, 0], scale: [1, 1.55] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }} />
      <motion.div style={{ position: 'absolute', inset: 0, borderRadius: radius, border: '1px solid rgba(255,255,255,0.35)' }}
        animate={{ opacity: [0.5, 0], scale: [1, 1.85] }}
        transition={{ duration: 1.4, delay: 0.45, repeat: Infinity, ease: 'easeOut' }} />
    </div>
  );
}

/* ── Phase 0 — button spotlight ── */
function ButtonSpotlight({ rect }: { rect: DOMRect | null }) {
  if (!rect) return null;
  const pad = 10;
  const hole = { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, pad };
  return (
    <>
      <SingleHoleOverlay hole={hole} onClick={() => {}} />
      <AnimatedRing rect={rect} pad={pad} radius={14} />
      <motion.div style={{ position: 'fixed', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, top: rect.bottom + pad + 10, left: rect.left + rect.width / 2, transform: 'translateX(-50%)', pointerEvents: 'none' }}
        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.3 }}>
        <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 1.1, repeat: Infinity }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M8 13L8 3M3 8L8 3L13 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)' }}>Apply Here</span>
      </motion.div>
    </>
  );
}

const STEPS = [
  { icon: 'fas fa-user', label: 'Personal Info',  desc: 'Your name, ID & address' },
  { icon: 'fas fa-briefcase', label: 'Employment', desc: 'Income & employer details' },
  { icon: 'fas fa-university', label: 'Banking',   desc: 'Where to disburse funds' },
  { icon: 'fas fa-check-circle', label: 'Review',  desc: 'Confirm & submit' },
];

/* ── Phase 1 — spotlight + step callout ── */
function StepCallout({ rect, onDone }: { rect: DOMRect | null; onDone: () => void }) {
  const navigate = useNavigate();
  if (!rect) return null;
  const pad = 10;
  const hole = { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, pad };

  const rightSpace = window.innerWidth - (rect.right + pad + 14);
  const leftSpace  = rect.left - pad - 14;
  const useRight   = rightSpace >= 200;
  const useLeft    = !useRight && leftSpace >= 200;
  const useBottom  = !useRight && !useLeft;

  const calloutW   = useRight ? Math.min(260, rightSpace - 8) : useLeft ? Math.min(260, leftSpace - 8) : undefined;
  const calloutTop = useRight || useLeft ? Math.max(72, rect.top - 20) : undefined;

  function go() { onDone(); navigate('/user-portal/apply'); }

  const textBlock = (
    <>
      <motion.p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.36 }}>
        Loan Application
      </motion.p>
      <motion.p style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, color: 'rgba(255,255,255,1.0)', marginBottom: 6 }}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}>
        Get a decision<br />in minutes
      </motion.p>
      <motion.p style={{ fontSize: 13, fontWeight: 400, lineHeight: 1.55, color: 'rgba(255,255,255,0.80)', marginBottom: 14 }}
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}>
        Apply fully online — no paperwork, no branch visits. Just 4 quick steps.
      </motion.p>

      <motion.div style={{ height: 1, background: 'rgba(255,255,255,0.20)', marginBottom: 12 }}
        initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.66, duration: 0.3 }} />

      <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.76 }}>
        {STEPS.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(124,58,237,0.60)', border: '1px solid rgba(167,139,250,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={s.icon} style={{ fontSize: 11, color: 'rgba(255,255,255,0.95)' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>
                {i + 1}. {s.label}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.60)' }}>{s.desc}</p>
            </div>
          </div>
        ))}
      </motion.div>

      <motion.div style={{ display: 'flex', gap: 8 }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }}>
        <motion.button onClick={go} whileTap={{ scale: 0.95 }}
          style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'white', background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', border: 'none', cursor: 'pointer' }}>
          Start Application →
        </motion.button>
        <motion.button onClick={onDone} whileTap={{ scale: 0.95 }}
          style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.30)', cursor: 'pointer' }}>
          Later
        </motion.button>
      </motion.div>
    </>
  );

  return (
    <>
      <SingleHoleOverlay hole={hole} onClick={onDone} />
      <AnimatedRing rect={rect} pad={pad} radius={14} />

      {/* Right callout */}
      {useRight && (
        <motion.div style={{ position: 'fixed', zIndex: 1002, top: calloutTop, left: rect.right + pad + 14, width: calloutW, display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}
          initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}>
          {textBlock}
        </motion.div>
      )}

      {/* Left callout */}
      {useLeft && (
        <motion.div style={{ position: 'fixed', zIndex: 1002, top: calloutTop, right: window.innerWidth - (rect.left - pad - 14), width: calloutW, display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}
          initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}>
          {textBlock}
        </motion.div>
      )}

      {/* Bottom sheet fallback (mobile / no side space) */}
      {useBottom && (
        <motion.div style={{ position: 'fixed', zIndex: 1002, bottom: 24, left: 16, right: 16, background: 'rgba(15,10,30,0.72)', backdropFilter: 'blur(18px)', borderRadius: 20, border: '1px solid rgba(124,58,237,0.40)', padding: '22px 20px 18px', pointerEvents: 'auto' }}
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
          {textBlock}
        </motion.div>
      )}
    </>
  );
}

/* ── Main export ── */
export default function LoanApplyExplainer({ targetRef, onDone }: {
  targetRef: React.RefObject<HTMLElement | null>;
  onDone: () => void;
}) {
  const [phase, setPhase]       = useState(0);
  const [rect, setRect]         = useState<DOMRect | null>(null);
  const [visible, setVisible]   = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let raf: number;
    let settled = false;

    function measure() {
      const candidates = document.querySelectorAll<HTMLElement>('[data-coach-apply="true"]');
      let best: HTMLElement | null = targetRef.current ?? null;
      candidates.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) best = el;
      });
      if (best) {
        const r = best.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect(r);
          settled = true;
          return;
        }
      }
      if (!settled) raf = requestAnimationFrame(measure);
    }

    function onResize() {
      const candidates = document.querySelectorAll<HTMLElement>('[data-coach-apply="true"]');
      let best: HTMLElement | null = targetRef.current ?? null;
      candidates.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) best = el;
      });
      if (best) setRect(best.getBoundingClientRect());
    }

    measure();
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, [targetRef]);

  useEffect(() => {
    if (phase !== 0) return;
    timer.current = setTimeout(() => setPhase(1), 2500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [phase]);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(LOAN_EXPLAINER_KEY, '1');
    setTimeout(() => onDone(), 320);
  }, [onDone]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {phase === 0 && (
        <motion.div key="phase0" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <ButtonSpotlight rect={rect} />
        </motion.div>
      )}
      {phase === 1 && (
        <motion.div key="phase1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <StepCallout rect={rect} onDone={dismiss} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
