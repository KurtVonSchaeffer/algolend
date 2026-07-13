import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';

const STEPS = ['Applicant', 'Loan Details', 'Review'];

export function CreateApplicationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    full_name: '', email: '', identity_number: '', cell_tel_no: '',
    amount: '', purpose: '', term_months: '12',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      // Find or create a profile by email
      let { data: profile } = await supabase
        .from('profiles').select('id').eq('email', form.email).maybeSingle();

      if (!profile) {
        const { data: newProfile, error: profErr } = await supabase
          .from('profiles')
          .insert([{ full_name: form.full_name, email: form.email, identity_number: form.identity_number, cell_tel_no: form.cell_tel_no }])
          .select().single();
        if (profErr) throw new Error(profErr.message);
        profile = newProfile;
      }

      const { data: app, error: appErr } = await supabase
        .from('loan_applications')
        .insert([{
          user_id: profile!.id,
          amount: Number(form.amount),
          purpose: form.purpose,
          term_months: Number(form.term_months),
          status: 'PENDING',
        }])
        .select().single();
      if (appErr) throw new Error(appErr.message);
      navigate(`/applications/${app.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to create application');
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="admin-icon-btn" onClick={() => navigate('/applications')}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          </button>
          <div>
            <h1 className="page-title">New Application</h1>
            <p className="page-subtitle">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
          </div>
        </div>
      </div>

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32, maxWidth: 500 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              background: i <= step ? 'var(--color-primary)' : 'var(--color-surface-muted)',
              color: i <= step ? '#fff' : 'var(--color-text-muted)',
            }}>{i + 1}</div>
            <span style={{ fontSize: 11, color: i === step ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: i === step ? 700 : 400 }}>{s}</span>
          </div>
        ))}
      </div>

      <div className="chart-card" style={{ maxWidth: 560 }}>
        {step === 0 && (
          <>
            <p className="chart-title">Applicant Information</p>
            {[
              { label: 'Full Name', key: 'full_name', type: 'text', placeholder: 'John Smith' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'john@example.com' },
              { label: 'ID Number', key: 'identity_number', type: 'text', placeholder: '8501015009087' },
              { label: 'Cell Number', key: 'cell_tel_no', type: 'tel', placeholder: '0821234567' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>{f.label}</label>
                <input className="admin-input" type={f.type} placeholder={f.placeholder}
                  value={(form as any)[f.key]} onChange={e => set(f.key, e.target.value)} />
              </div>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <p className="chart-title">Loan Details</p>
            {[
              { label: 'Loan Amount (ZAR)', key: 'amount', type: 'number', placeholder: '50000' },
              { label: 'Term (months)', key: 'term_months', type: 'number', placeholder: '12' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>{f.label}</label>
                <input className="admin-input" type={f.type} placeholder={f.placeholder}
                  value={(form as any)[f.key]} onChange={e => set(f.key, e.target.value)} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Purpose</label>
              <select className="admin-select" value={form.purpose} onChange={e => set('purpose', e.target.value)}>
                <option value="">Select purpose…</option>
                {['Business', 'Personal', 'Debt Consolidation', 'Education', 'Home Improvement', 'Medical', 'Vehicle', 'Other'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="chart-title">Review &amp; Submit</p>
            {[
              ['Applicant', form.full_name], ['Email', form.email],
              ['ID Number', form.identity_number], ['Cell', form.cell_tel_no],
              ['Amount', `R ${Number(form.amount).toLocaleString('en-ZA')}`],
              ['Term', `${form.term_months} months`], ['Purpose', form.purpose],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{value || '—'}</span>
              </div>
            ))}
            {error && <p style={{ color: '#EF4444', marginTop: 16, fontSize: 13 }}>{error}</p>}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          {step > 0 && <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>Back</button>}
          {step < STEPS.length - 1
            ? <button className="btn btn-primary" onClick={() => setStep(s => s + 1)}>Continue</button>
            : <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Creating…' : 'Create Application'}
              </button>
          }
        </div>
      </div>
    </>
  );
}
