import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

type Mode = 'draw' | 'type' | 'upload';

const CURSIVE_FONTS = [
  'Dancing Script, cursive',
  'Pacifico, cursive',
  'Great Vibes, cursive',
];

interface Props {
  onConfirm: (dataUrl: string, mode: Mode, signerName: string) => void;
  onCancel: () => void;
  defaultName?: string;
}

export function SignaturePad({ onConfirm, onCancel, defaultName = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('draw');
  const [drawing, setDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [typedName, setTypedName] = useState(defaultName);
  const [fontIdx, setFontIdx] = useState(0);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [signerName, setSignerName] = useState(defaultName);

  /* ── Canvas helpers ──────────────────────────────────────────────────── */
  const ctx = () => canvasRef.current?.getContext('2d') ?? null;

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    const g = ctx();
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    setIsEmpty(true);
  }, []);

  useEffect(() => {
    if (mode !== 'draw') return;
    const c = canvasRef.current;
    const g = ctx();
    if (!c || !g) return;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#1a1a2e';
    g.lineWidth = 2.5;
  }, [mode]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const c = canvasRef.current;
    const g = ctx();
    if (!c || !g) return;
    const { x, y } = getPos(e, c);
    g.beginPath();
    g.moveTo(x, y);
    setDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing) return;
    const c = canvasRef.current;
    const g = ctx();
    if (!c || !g) return;
    const { x, y } = getPos(e, c);
    g.lineTo(x, y);
    g.stroke();
    setIsEmpty(false);
  };

  const stopDraw = () => setDrawing(false);

  /* ── Typed signature preview ─────────────────────────────────────────── */
  const typedDataUrl = useCallback(() => {
    const c = document.createElement('canvas');
    c.width = 480; c.height = 160;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 480, 160);
    g.font = `64px ${CURSIVE_FONTS[fontIdx]}`;
    g.fillStyle = '#1a1a2e';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText(typedName || 'Signature', 240, 80);
    return c.toDataURL('image/png');
  }, [typedName, fontIdx]);

  /* ── Confirm ─────────────────────────────────────────────────────────── */
  const handleConfirm = () => {
    if (mode === 'draw') {
      const dataUrl = canvasRef.current?.toDataURL('image/png') ?? '';
      onConfirm(dataUrl, 'draw', signerName);
    } else if (mode === 'type') {
      onConfirm(typedDataUrl(), 'type', signerName);
    } else if (uploadUrl) {
      onConfirm(uploadUrl, 'upload', signerName);
    }
  };

  const canConfirm =
    (mode === 'draw' && !isEmpty) ||
    (mode === 'type' && typedName.trim().length > 1) ||
    (mode === 'upload' && !!uploadUrl);

  /* ── UI ──────────────────────────────────────────────────────────────── */
  const tabStyle = (t: Mode): React.CSSProperties => ({
    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
    borderBottom: mode === t ? '2px solid var(--color-primary, #7c3aed)' : '2px solid transparent',
    background: 'transparent', color: mode === t ? 'var(--color-primary, #7c3aed)' : '#6b7280',
    transition: 'color 0.15s',
  });

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>Sign Contract</h3>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Your signature confirms agreement to the loan terms</p>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20 }}>✕</button>
        </div>

        {/* Signer name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Full Name (as it appears on ID)</label>
          <input
            value={signerName}
            onChange={e => { setSignerName(e.target.value); setTypedName(e.target.value); }}
            placeholder="e.g. Thabo Nkosi"
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6', marginBottom: 16 }}>
          <button style={tabStyle('draw')} onClick={() => setMode('draw')}>Draw</button>
          <button style={tabStyle('type')} onClick={() => setMode('type')}>Type</button>
          <button style={tabStyle('upload')} onClick={() => setMode('upload')}>Upload</button>
        </div>

        {/* Draw tab */}
        {mode === 'draw' && (
          <div>
            <div style={{ position: 'relative', border: '1.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fafafa', marginBottom: 10 }}>
              <canvas
                ref={canvasRef}
                width={460}
                height={160}
                style={{ display: 'block', width: '100%', height: 160, cursor: 'crosshair', touchAction: 'none' }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
              {isEmpty && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 13, color: '#d1d5db' }}>Sign here with your mouse or finger</span>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: '60%', height: 1, background: '#e5e7eb' }} />
            </div>
            <button onClick={clearCanvas} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>Clear</button>
          </div>
        )}

        {/* Type tab */}
        {mode === 'type' && (
          <div>
            <input
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder="Type your full name"
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none', marginBottom: 12 }}
            />
            <div style={{ border: '1.5px solid #e5e7eb', borderRadius: 12, background: '#fafafa', padding: '20px 24px', textAlign: 'center', marginBottom: 10, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: CURSIVE_FONTS[fontIdx], fontSize: 48, color: '#1a1a2e', lineHeight: 1 }}>
                {typedName || <span style={{ color: '#d1d5db', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>Your signature preview</span>}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {CURSIVE_FONTS.map((f, i) => (
                <button key={f} onClick={() => setFontIdx(i)} style={{ flex: 1, padding: '6px 0', border: `1.5px solid ${fontIdx === i ? 'var(--color-primary,#7c3aed)' : '#e5e7eb'}`, borderRadius: 8, background: fontIdx === i ? 'rgba(124,58,237,0.07)' : '#fff', cursor: 'pointer', fontFamily: f, fontSize: 16, color: '#1a1a2e' }}>
                  Aa
                </button>
              ))}
            </div>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&family=Pacifico&family=Great+Vibes&display=swap" />
          </div>
        )}

        {/* Upload tab */}
        {mode === 'upload' && (
          <div>
            <label style={{ display: 'block', border: '2px dashed #e5e7eb', borderRadius: 12, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: '#fafafa', marginBottom: 10 }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = ev => setUploadUrl(ev.target?.result as string);
                reader.readAsDataURL(f);
              }} />
              {uploadUrl
                ? <img src={uploadUrl} alt="Uploaded signature" style={{ maxHeight: 100, maxWidth: '100%', objectFit: 'contain' }} />
                : <>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 8 }}>upload</span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Click to upload signature image (PNG, JPG)</span>
                </>
              }
            </label>
            {uploadUrl && <button onClick={() => setUploadUrl(null)} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>}
          </div>
        )}

        {/* Legal notice */}
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '16px 0 20px', lineHeight: 1.5 }}>
          By confirming, you acknowledge this constitutes a legally binding electronic signature in terms of the Electronic Communications and Transactions Act (ECTA) No. 25 of 2002.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px 0', border: '1.5px solid #e5e7eb', borderRadius: 12, background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{ flex: 2, padding: '12px 0', border: 'none', borderRadius: 12, background: canConfirm ? 'var(--color-primary,#7c3aed)' : '#e5e7eb', color: canConfirm ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 700, cursor: canConfirm ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}
          >
            Confirm Signature
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
