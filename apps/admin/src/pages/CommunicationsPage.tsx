import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AdminPageShell } from '../components/ui/AdminPage';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../api/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

type Channel = 'WhatsApp' | 'SMS' | 'Email';
type Category = 'ALL' | 'Onboarding' | 'Payment' | 'Collections' | 'Compliance' | 'Statement';

interface WaMessage {
  id: string;
  wa_message_id: string | null;
  from_phone: string;
  message_type: string;
  message_text: string | null;
  direction: 'inbound' | 'outbound';
  status: 'unread' | 'read' | 'sent';
  received_at: string;
  profiles?: { full_name: string | null; cell_tel_no: string | null } | null;
}

interface WaConversation {
  phone: string;
  borrowerName: string | null;
  borrowerId: string | null;
  messages: WaMessage[];
  unread: number;
  lastMessage: WaMessage;
}

interface Template {
  id: string;
  name: string;
  channel: Channel;
  category: Exclude<Category, 'ALL'>;
  subject?: string;
  body: string;
  variables: string[];
}

interface SendLog {
  id: string;
  templateId: string;
  recipient: string;
  channel: Channel;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'PENDING';
  sentAt: string;
  templateName: string;
}

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  {
    id: 't001', name: 'Welcome — Loan Approved', channel: 'WhatsApp', category: 'Onboarding',
    body: 'Hi {{first_name}}, congratulations! Your AlgoLend loan of {{loan_amount}} has been approved. Funds will be disbursed to your {{bank_name}} account ending {{account_last4}} within 24 hours. Reference: {{loan_id}}.',
    variables: ['first_name', 'loan_amount', 'bank_name', 'account_last4', 'loan_id'],
  },
  {
    id: 't002', name: 'Application Received', channel: 'SMS', category: 'Onboarding',
    body: 'AlgoLend: Hi {{first_name}}, your loan application {{app_id}} has been received. We will contact you within 1 business day. Reply STOP to opt out.',
    variables: ['first_name', 'app_id'],
  },
  {
    id: 't003', name: 'Payment Reminder — 3 Days', channel: 'WhatsApp', category: 'Payment',
    body: 'Hi {{first_name}}, your AlgoLend installment of {{amount}} is due on {{due_date}}. Please ensure funds are available in your account. Need help? Call 0800 000 000.',
    variables: ['first_name', 'amount', 'due_date'],
  },
  {
    id: 't004', name: 'Payment Confirmed', channel: 'SMS', category: 'Payment',
    body: 'AlgoLend: Payment of {{amount}} received on {{date}}. Remaining balance: {{balance}}. Thank you, {{first_name}}! Reply STOP to opt out.',
    variables: ['amount', 'date', 'balance', 'first_name'],
  },
  {
    id: 't005', name: 'Monthly Statement', channel: 'Email', category: 'Statement',
    subject: 'Your AlgoLend Statement — {{month}} {{year}}',
    body: 'Dear {{full_name}},\n\nPlease find your monthly statement for {{month}} {{year}} attached.\n\nLoan Balance: {{balance}}\nNext Payment: {{next_payment}} due {{due_date}}\n\nLog in at algolend.co.za to view your full account details.\n\nKind regards,\nAlgoLend Team',
    variables: ['full_name', 'month', 'year', 'balance', 'next_payment', 'due_date'],
  },
  {
    id: 't006', name: 'First Arrears Notice', channel: 'WhatsApp', category: 'Collections',
    body: 'Hi {{first_name}}, your payment of {{amount}} was due on {{due_date}} and has not been received. Please make payment immediately to avoid additional charges. Call us on 0800 000 000 or visit algolend.co.za.',
    variables: ['first_name', 'amount', 'due_date'],
  },
  {
    id: 't007', name: 'Section 129 Notice', channel: 'Email', category: 'Collections',
    subject: 'Section 129 Notice — Overdue Account {{loan_id}}',
    body: 'Dear {{full_name}},\n\nIn terms of Section 129 of the National Credit Act (NCA), we hereby notify you that your account ({{loan_id}}) is in arrears by {{arrears_amount}}.\n\nYou have the right to refer this matter to a debt counsellor, alternative dispute resolution agent, or the National Credit Regulator.\n\nPlease contact us within 10 business days to make arrangements.\n\nAlgoLend Credit (Pty) Ltd — NCR Registration: NCRCP XXXXX',
    variables: ['full_name', 'loan_id', 'arrears_amount'],
  },
  {
    id: 't008', name: 'FICA Document Request', channel: 'Email', category: 'Compliance',
    subject: 'Action Required: FICA Documents — {{full_name}}',
    body: 'Dear {{full_name}},\n\nIn terms of the Financial Intelligence Centre Act (FICA), we require updated identity documentation to maintain your account.\n\nRequired documents:\n- Valid South African ID or Passport\n- Proof of residential address (not older than 3 months)\n\nPlease submit documents via our portal at algolend.co.za/portal or email to compliance@algolend.co.za\n\nDeadline: {{deadline}}\n\nAlgoLend Compliance Team',
    variables: ['full_name', 'deadline'],
  },
  {
    id: 't009', name: 'Debit Order Failure', channel: 'SMS', category: 'Collections',
    body: 'AlgoLend: Your debit order of {{amount}} on {{date}} was unsuccessful. Please ensure {{amount}} is in your account and call 0800 000 000. Ref: {{loan_id}}. Reply STOP to opt out.',
    variables: ['amount', 'date', 'loan_id'],
  },
  {
    id: 't010', name: 'Loan Settled', channel: 'WhatsApp', category: 'Statement',
    body: 'Congratulations {{first_name}}! Your AlgoLend loan {{loan_id}} has been fully settled. Your clearance certificate will be issued within 5 business days. Thank you for banking with us!',
    variables: ['first_name', 'loan_id'],
  },
];

const SEND_LOG: SendLog[] = [
  { id: 'sl001', templateId: 't003', templateName: 'Payment Reminder — 3 Days', recipient: 'Nomsa Sithole', channel: 'WhatsApp', status: 'DELIVERED', sentAt: '2026-08-10T08:00:00Z' },
  { id: 'sl002', templateId: 't006', templateName: 'First Arrears Notice', recipient: 'Ahmed Patel', channel: 'WhatsApp', status: 'DELIVERED', sentAt: '2026-08-09T09:15:00Z' },
  { id: 'sl003', templateId: 't007', templateName: 'Section 129 Notice', recipient: 'Ahmed Patel', channel: 'Email', status: 'DELIVERED', sentAt: '2026-08-01T10:00:00Z' },
  { id: 'sl004', templateId: 't004', templateName: 'Payment Confirmed', recipient: 'Thabo Nkosi', channel: 'SMS', status: 'DELIVERED', sentAt: '2026-08-08T14:22:00Z' },
  { id: 'sl005', templateId: 't009', templateName: 'Debit Order Failure', recipient: 'Lerato Mokoena', channel: 'SMS', status: 'FAILED', sentAt: '2026-08-07T07:00:00Z' },
  { id: 'sl006', templateId: 't005', templateName: 'Monthly Statement', recipient: 'Zanele Dlamini', channel: 'Email', status: 'DELIVERED', sentAt: '2026-08-01T06:00:00Z' },
  { id: 'sl007', templateId: 't001', templateName: 'Welcome — Loan Approved', recipient: 'Sipho Mthembu', channel: 'WhatsApp', status: 'DELIVERED', sentAt: '2026-07-30T11:05:00Z' },
  { id: 'sl008', templateId: 't008', templateName: 'FICA Document Request', recipient: 'David Botha', channel: 'Email', status: 'DELIVERED', sentAt: '2026-07-25T09:00:00Z' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHANNEL_ICON: Record<Channel, string> = { WhatsApp: 'chat', SMS: 'sms', Email: 'mail' };
const CHANNEL_COLOR: Record<Channel, string> = { WhatsApp: '#25d366', SMS: '#2563eb', Email: '#7c3aed' };

const STATUS_CONFIG = {
  SENT:      { label: 'Sent',      color: '#d97706', bg: '#fffbeb', icon: 'schedule' },
  DELIVERED: { label: 'Delivered', color: '#059669', bg: '#f0fdf4', icon: 'done_all' },
  FAILED:    { label: 'Failed',    color: '#dc2626', bg: '#fef2f2', icon: 'error' },
  PENDING:   { label: 'Pending',   color: '#6b7280', bg: '#f3f4f6', icon: 'hourglass_empty' },
};

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ── Component ─────────────────────────────────────────────────────────────────

export function CommunicationsPage() {
  const { success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo } = useToast();
  const [tab, setTab] = useState<'Templates' | 'Log' | 'Compose' | 'Inbox'>('Templates');
  const [category, setCategory] = useState<Category>('ALL');
  const [channelFilter, setChannelFilter] = useState<Channel | 'ALL'>('ALL');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [composeVars, setComposeVars] = useState<Record<string, string>>({});
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composePhone, setComposePhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sendLog, setSendLog] = useState<SendLog[]>(SEND_LOG);

  // ── Inbox state ──────────────────────────────────────────────────────────────
  const [conversations, setConversations]   = useState<WaConversation[]>([]);
  const [activePhone, setActivePhone]       = useState<string | null>(null);
  const [inboxLoading, setInboxLoading]     = useState(false);
  const [replyText, setReplyText]           = useState('');
  const [replying, setReplying]             = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const authHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token ?? ''}` };
  }, []);

  const loadConversations = useCallback(async () => {
    setInboxLoading(true);
    try {
      const headers = await authHeader();
      const res = await fetch('/api/admin/whatsapp/conversations', { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const { conversations: convs } = await res.json();
      setConversations(convs || []);
    } catch (err: any) {
      toastError('Failed to load inbox', err.message);
    } finally {
      setInboxLoading(false);
    }
  }, [authHeader, toastError]);

  useEffect(() => {
    if (tab === 'Inbox') loadConversations();
  }, [tab, loadConversations]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [activePhone, conversations]);

  const activeConv = conversations.find(c => c.phone === activePhone) ?? null;
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  const handleMarkRead = useCallback(async (phone: string) => {
    try {
      const headers = await authHeader();
      await fetch(`/api/admin/whatsapp/read/${encodeURIComponent(phone)}`, { method: 'PATCH', headers });
      setConversations(prev => prev.map(c =>
        c.phone === phone ? { ...c, unread: 0, messages: c.messages.map(m => ({ ...m, status: m.direction === 'inbound' ? 'read' : m.status })) } : c
      ));
    } catch (_) {}
  }, [authHeader]);

  const handleSelectConv = useCallback((phone: string, unread: number) => {
    setActivePhone(phone);
    if (unread > 0) handleMarkRead(phone);
  }, [handleMarkRead]);

  const handleReply = useCallback(async () => {
    if (!activePhone || !replyText.trim()) return;
    setReplying(true);
    try {
      const headers = await authHeader();
      const res = await fetch('/api/admin/whatsapp/reply', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: activePhone, message: replyText.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Send failed (${res.status})`);
      }
      const optimistic: WaMessage = {
        id: `opt-${Date.now()}`, wa_message_id: null,
        from_phone: activePhone, message_type: 'text',
        message_text: replyText.trim(), direction: 'outbound',
        status: 'sent', received_at: new Date().toISOString(),
      };
      setConversations(prev => prev.map(c =>
        c.phone === activePhone
          ? { ...c, messages: [...c.messages, optimistic], lastMessage: optimistic }
          : c
      ));
      setReplyText('');
      toastSuccess('Reply sent', `Message delivered to ${activePhone}`);
    } catch (err: any) {
      toastError('Reply failed', err.message);
    } finally {
      setReplying(false);
    }
  }, [activePhone, replyText, authHeader, toastSuccess, toastError]);

  const filteredTemplates = useMemo(() => TEMPLATES.filter(t => {
    const catOk = category === 'ALL' || t.category === category;
    const chOk = channelFilter === 'ALL' || t.channel === channelFilter;
    return catOk && chOk;
  }), [category, channelFilter]);

  const resolvedBody = useMemo(() => {
    if (!selectedTemplate) return '';
    let body = selectedTemplate.body;
    for (const [k, v] of Object.entries(composeVars)) {
      body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `{{${k}}}`);
    }
    return body;
  }, [selectedTemplate, composeVars]);

  const handleSend = async () => {
    if (!selectedTemplate || !composeRecipient) return;
    if (selectedTemplate.channel === 'Email') {
      toastInfo('Email sends are automated', 'Email templates are triggered by system events. Use notify-to-sign or compliance workflows to send emails.');
      return;
    }
    if (!composePhone.trim()) {
      toastWarning('Phone number required', `Enter the recipient's number to send via ${selectedTemplate.channel}`);
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/messaging/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composePhone.trim(),
          message: resolvedBody || selectedTemplate.body,
          channel: selectedTemplate.channel.toLowerCase(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Send failed (${res.status})`);
      }
      const entry: SendLog = {
        id: `sl${Date.now()}`, templateId: selectedTemplate.id,
        templateName: selectedTemplate.name, recipient: composeRecipient,
        channel: selectedTemplate.channel, status: 'SENT',
        sentAt: new Date().toISOString(),
      };
      setSendLog(prev => [entry, ...prev]);
      toastSuccess(`${selectedTemplate.channel} sent`, `Delivered to ${composeRecipient} (${composePhone})`);
      setTab('Log');
      setSelectedTemplate(null);
      setComposeRecipient('');
      setComposePhone('');
      setComposeVars({});
    } catch (err: any) {
      toastError('Send failed', err.message);
    } finally {
      setSending(false);
    }
  };

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  };

  const CATEGORIES: Category[] = ['ALL', 'Onboarding', 'Payment', 'Collections', 'Compliance', 'Statement'];
  const CHANNELS: (Channel | 'ALL')[] = ['ALL', 'WhatsApp', 'SMS', 'Email'];

  const deliveredCount = sendLog.filter(l => l.status === 'DELIVERED').length;
  const failedCount = sendLog.filter(l => l.status === 'FAILED').length;
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d: string) => {
    const dt = new Date(d);
    const today = new Date();
    if (dt.toDateString() === today.toDateString()) return fmtTime(d);
    return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
  };

  return (
    <AdminPageShell>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', margin: 0 }}>Communications Hub</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Manage message templates and send WhatsApp, SMS, and Email communications to clients.
        </p>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Templates', value: TEMPLATES.length, icon: 'description', color: '#7c3aed' },
          { label: 'Sent This Month', value: sendLog.length, icon: 'send', color: '#2563eb' },
          { label: 'Delivered', value: deliveredCount, icon: 'done_all', color: '#059669' },
          { label: 'Unread Messages', value: totalUnread, icon: 'mark_chat_unread', color: totalUnread > 0 ? '#dc2626' : '#6b7280' },
        ].map(k => (
          <div key={k.label} style={{ ...card, padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: k.color }}>{k.icon}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ ...card, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          {(['Templates', 'Log', 'Compose', 'Inbox'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '14px 24px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: tab === t ? 700 : 500, fontSize: 14,
              color: tab === t ? 'var(--color-primary, #7c3aed)' : '#6b7280',
              borderBottom: tab === t ? '2px solid var(--color-primary, #7c3aed)' : '2px solid transparent',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t === 'Log' ? 'Send Log' : t}
              {t === 'Log' && <span style={{ fontSize: 10, background: '#f3f4f6', padding: '1px 6px', borderRadius: 20, color: '#6b7280', fontWeight: 700 }}>{sendLog.length}</span>}
              {t === 'Inbox' && totalUnread > 0 && (
                <span style={{ fontSize: 10, background: '#dc2626', padding: '1px 6px', borderRadius: 20, color: '#fff', fontWeight: 800 }}>{totalUnread}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Templates tab ── */}
        {tab === 'Templates' && (
          <div style={{ padding: 20 }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                    background: category === c ? 'var(--color-primary, #7c3aed)' : '#f3f4f6',
                    color: category === c ? '#fff' : '#6b7280',
                  }}>
                    {c === 'ALL' ? 'All Categories' : c}
                  </button>
                ))}
              </div>
              <div style={{ width: 1, height: 28, background: '#e5e7eb', flexShrink: 0 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {CHANNELS.map(ch => (
                  <button key={ch} onClick={() => setChannelFilter(ch)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                    background: channelFilter === ch ? (ch === 'ALL' ? '#111827' : CHANNEL_COLOR[ch as Channel]) : '#f3f4f6',
                    color: channelFilter === ch ? '#fff' : '#6b7280',
                  }}>
                    {ch === 'ALL' ? 'All Channels' : ch}
                  </button>
                ))}
              </div>
            </div>

            {/* Template grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {filteredTemplates.map(tmpl => (
                <div key={tmpl.id} style={{
                  border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden',
                  background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'box-shadow 0.15s',
                }}>
                  {/* Card header */}
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${CHANNEL_COLOR[tmpl.channel]}18`,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: CHANNEL_COLOR[tmpl.channel] }}>{CHANNEL_ICON[tmpl.channel]}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tmpl.name}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: `${CHANNEL_COLOR[tmpl.channel]}18`, color: CHANNEL_COLOR[tmpl.channel] }}>
                          {tmpl.channel}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280' }}>
                          {tmpl.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body preview */}
                  <div style={{ padding: '12px 16px', fontSize: 11, color: '#6b7280', lineHeight: 1.6, minHeight: 60 }}>
                    {tmpl.body.slice(0, 120)}{tmpl.body.length > 120 ? '…' : ''}
                  </div>

                  {/* Variables */}
                  {tmpl.variables.length > 0 && (
                    <div style={{ padding: '8px 16px', background: '#f9fafb', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {tmpl.variables.map(v => (
                        <span key={v} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: '#e0e7ff', color: '#3730a3', fontFamily: 'monospace', fontWeight: 600 }}>
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8 }}>
                    <button onClick={() => { setSelectedTemplate(tmpl); setComposeVars({}); setTab('Compose'); }} style={{
                      flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'var(--color-primary, #7c3aed)', color: '#fff', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>send</span>
                      Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Send Log tab ── */}
        {tab === 'Log' && (
          <div>
            {sendLog.map((log, i) => {
              const st = STATUS_CONFIG[log.status];
              return (
                <div key={log.id} style={{
                  padding: '14px 20px', borderBottom: i < sendLog.length - 1 ? '1px solid #f3f4f6' : 'none',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: `${CHANNEL_COLOR[log.channel]}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: CHANNEL_COLOR[log.channel] }}>{CHANNEL_ICON[log.channel]}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{log.templateName}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      To: <strong>{log.recipient}</strong> · {log.channel} · {fmtDateTime(log.sentAt)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    background: st.bg, color: st.color, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{st.icon}</span>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Compose tab ── */}
        {tab === 'Compose' && (
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Left: form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Template</label>
                <select value={selectedTemplate?.id ?? ''} onChange={e => {
                  const t = TEMPLATES.find(t => t.id === e.target.value) ?? null;
                  setSelectedTemplate(t);
                  setComposeVars({});
                }} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff' }}>
                  <option value="">— Select a template —</option>
                  {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.channel} · {t.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Recipient Name</label>
                <input value={composeRecipient} onChange={e => setComposeRecipient(e.target.value)}
                  placeholder="e.g. Thabo Nkosi"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {selectedTemplate?.channel === 'Email' ? (
                <div style={{ padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: 12, color: '#1e40af', display: 'flex', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>info</span>
                  <span>Email templates are triggered automatically by system events (signing, onboarding, statements). Manual email compose is not available.</span>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                    Phone Number{selectedTemplate ? ` (${selectedTemplate.channel})` : ''}
                  </label>
                  <input
                    value={composePhone}
                    onChange={e => setComposePhone(e.target.value)}
                    placeholder="e.g. +27821234567"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              {selectedTemplate && selectedTemplate.variables.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Template Variables</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedTemplate.variables.map(v => (
                      <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: 11, color: '#3730a3', background: '#e0e7ff', padding: '4px 8px', borderRadius: 6, width: 140, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {`{{${v}}}`}
                        </code>
                        <input value={composeVars[v] ?? ''} onChange={e => setComposeVars(prev => ({ ...prev, [v]: e.target.value }))}
                          placeholder={`Enter ${v.replace(/_/g, ' ')}`}
                          style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, outline: 'none' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(() => {
                const isEmail = selectedTemplate?.channel === 'Email';
                const canSend = !isEmail && !!selectedTemplate && !!composeRecipient && !!composePhone.trim() && !sending;
                return (
                  <button onClick={handleSend} disabled={!canSend} style={{
                    padding: '12px 24px', borderRadius: 12, border: 'none', cursor: canSend ? 'pointer' : 'not-allowed',
                    background: canSend ? 'var(--color-primary, #7c3aed)' : '#e5e7eb',
                    color: canSend ? '#fff' : '#9ca3af',
                    fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: canSend ? '0 2px 10px rgba(124,58,237,0.3)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      {sending ? 'hourglass_top' : 'send'}
                    </span>
                    {sending ? 'Sending…' : isEmail ? 'Email Auto-Triggered' : 'Send Message'}
                  </button>
                );
              })()}
            </div>

            {/* Right: preview */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Live Preview</label>
              {selectedTemplate ? (
                <div style={{
                  border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden',
                  background: selectedTemplate.channel === 'WhatsApp' ? '#e5ddd5' : '#f9fafb',
                }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: CHANNEL_COLOR[selectedTemplate.channel], display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#fff' }}>{CHANNEL_ICON[selectedTemplate.channel]}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>AlgoLend · {selectedTemplate.channel}</span>
                  </div>
                  {selectedTemplate.subject && (
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700 }}>
                      Subject: {resolvedBody ? selectedTemplate.subject.replace(/{{(\w+)}}/g, (_, k) => composeVars[k] ?? `{{${k}}}`) : selectedTemplate.subject}
                    </div>
                  )}
                  <div style={{ padding: 14 }}>
                    <div style={{
                      background: selectedTemplate.channel === 'WhatsApp' ? '#fff' : '#fff',
                      borderRadius: 10, padding: '12px 14px', fontSize: 12, lineHeight: 1.7, color: '#111827',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)', whiteSpace: 'pre-wrap',
                    }}>
                      {resolvedBody || selectedTemplate.body}
                    </div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, textAlign: 'right' }}>
                      {new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })} ✓
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ border: '2px dashed #e5e7eb', borderRadius: 14, padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>chat_bubble_outline</span>
                  Select a template to preview
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── Inbox tab ── */}
        {tab === 'Inbox' && (
          <div style={{ display: 'flex', height: 560 }}>
            {/* Conversation list */}
            <div style={{ width: 280, borderRight: '1px solid #f3f4f6', overflowY: 'auto', flexShrink: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#374151' }}>Conversations</span>
                <button onClick={loadConversations} disabled={inboxLoading} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, animation: inboxLoading ? 'spin 1s linear infinite' : 'none' }}>refresh</span>
                </button>
              </div>

              {inboxLoading && conversations.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Loading…</div>
              ) : conversations.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>chat_bubble_outline</span>
                  No messages yet.<br />Inbound WhatsApp messages will appear here.
                </div>
              ) : (
                conversations.map(conv => (
                  <button key={conv.phone} onClick={() => handleSelectConv(conv.phone, conv.unread)} style={{
                    width: '100%', padding: '12px 16px', border: 'none', background: activePhone === conv.phone ? '#f5f3ff' : 'transparent',
                    cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #f9fafb',
                    borderLeft: activePhone === conv.phone ? '3px solid #7c3aed' : '3px solid transparent',
                    transition: 'all 0.1s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        {conv.borrowerName || conv.phone}
                      </span>
                      <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(conv.lastMessage.received_at)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {conv.lastMessage.direction === 'outbound' && <span style={{ color: '#9ca3af' }}>You: </span>}
                        {conv.lastMessage.message_text || `[${conv.lastMessage.message_type}]`}
                      </span>
                      {conv.unread > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 800, background: '#25d366', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {conv.unread}
                        </span>
                      )}
                    </div>
                    {conv.borrowerName && (
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{conv.phone}</div>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Thread view */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {!activeConv ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexDirection: 'column', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#25d366' }}>whatsapp</span>
                  <span style={{ fontSize: 13 }}>Select a conversation</span>
                </div>
              ) : (
                <>
                  {/* Thread header */}
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#25d36618', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#25d366' }}>person</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{activeConv.borrowerName || activeConv.phone}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{activeConv.borrowerName ? activeConv.phone : 'Unknown borrower'}</div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#f0f2f5', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activeConv.messages.map(msg => (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '70%', padding: '8px 12px', borderRadius: msg.direction === 'outbound' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          background: msg.direction === 'outbound' ? '#dcf8c6' : '#fff',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)', fontSize: 13, color: '#111827', lineHeight: 1.5,
                        }}>
                          {msg.message_text || <em style={{ color: '#9ca3af' }}>[{msg.message_type}]</em>}
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, textAlign: 'right' }}>
                            {fmtTime(msg.received_at)}
                            {msg.direction === 'outbound' && <span style={{ marginLeft: 4 }}>✓</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply input */}
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 10, alignItems: 'flex-end', background: '#fff' }}>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                      placeholder="Type a message… (Enter to send)"
                      rows={2}
                      style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 13, outline: 'none', resize: 'none', lineHeight: 1.5, fontFamily: 'inherit' }}
                    />
                    <button onClick={handleReply} disabled={replying || !replyText.trim()} style={{
                      width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
                      background: replyText.trim() ? '#25d366' : '#e5e7eb', cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: replyText.trim() ? '#fff' : '#9ca3af' }}>
                        {replying ? 'hourglass_top' : 'send'}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </AdminPageShell>
  );
}
