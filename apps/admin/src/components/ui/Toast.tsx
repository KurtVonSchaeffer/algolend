import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
  removing?: boolean;
}

interface ToastContextValue {
  show: (opts: Omit<ToastItem, 'id' | 'removing'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICONS: Record<ToastType, string> = {
  success: 'check_circle',
  error:   'error',
  warning: 'warning',
  info:    'info',
};

const COLORS: Record<ToastType, { bg: string; icon: string; bar: string }> = {
  success: { bg: '#f0fdf4', icon: '#10b981', bar: '#10b981' },
  error:   { bg: '#fef2f2', icon: '#ef4444', bar: '#ef4444' },
  warning: { bg: '#fffbeb', icon: '#f59e0b', bar: '#f59e0b' },
  info:    { bg: '#eff6ff', icon: '#3b82f6', bar: '#3b82f6' },
};

function ToastBubble({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const colors = COLORS[item.type];
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(item.id), item.duration);
    return () => clearTimeout(timerRef.current);
  }, [item.id, item.duration, onRemove]);

  const animation = item.removing
    ? 'toastOut 0.28s cubic-bezier(0.4, 0, 1, 1) forwards'
    : 'toastIn  0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards';

  return (
    <div style={{
      position: 'relative',
      minWidth: 300,
      maxWidth: 380,
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)',
      overflow: 'hidden',
      animation,
      border: '1px solid #e2e8f0',
    }}>
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: colors.icon, borderRadius: '4px 0 0 4px' }} />

      {/* Content */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 14px 14px 18px' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: colors.icon, fontVariationSettings: "'FILL' 1" }}>
            {ICONS[item.type]}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{item.title}</p>
          {item.message && (
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{item.message}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(item.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0, marginTop: -1 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      {/* Progress bar */}
      <div ref={progressRef} style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 3,
        background: colors.bar,
        opacity: 0.6,
        borderRadius: 0,
        animation: `toastProgress ${item.duration}ms linear forwards`,
      }} />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320);
  }, []);

  const show = useCallback((opts: Omit<ToastItem, 'id' | 'removing'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-3), { ...opts, id }]);
  }, []);

  const success = useCallback((title: string, message?: string) =>
    show({ type: 'success', title, message, duration: 4000 }), [show]);
  const error = useCallback((title: string, message?: string) =>
    show({ type: 'error', title, message, duration: 5000 }), [show]);
  const warning = useCallback((title: string, message?: string) =>
    show({ type: 'warning', title, message, duration: 4500 }), [show]);
  const info = useCallback((title: string, message?: string) =>
    show({ type: 'info', title, message, duration: 4000 }), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, warning, info }}>
      {children}
      {createPortal(
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}>
          {toasts.map(t => (
            <div key={t.id} style={{ pointerEvents: 'all' }}>
              <ToastBubble item={t} onRemove={removeToast} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
