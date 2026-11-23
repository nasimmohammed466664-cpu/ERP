import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Bootstrap, type Conflict } from '../api';
import { money, reasonAr, time } from '../format';
import Icon from '../components/Icon';

const METHOD: Record<string, string> = { CASH: 'نقدًا', CREDIT: 'آجل', JAIB: 'جيب', JAWALI: 'جوالي', ONECASH: 'ون كاش', KURAIMI: 'الكريمي' };
type Panel = null | 'override' | 'reject' | 'move';

export default function Conflicts({ boot, reload }: { boot: Bootstrap; reload: () => Promise<void> }) {
  const [data, setData] = useState<{ conflicts: Conflict[]; open_shifts: { id: string; opened_at: string }[] } | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api('/sync-conflicts')); setErr(''); }
    catch (e) { setErr(e instanceof ApiError && e.status === 0 ? 'لا يوجد اتصال بالخادم. ستظهر الحالة عند عودة الاتصال.' : 'تعذّر تحميل الإيصالات المعلّقة.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="stack conflict-screen">
      <div className="sync-explainer">
        <span className="sync-explainer-icon"><Icon name="inbox" size={23} /></span>
        <div><strong>مبيعاتك محفوظة بأمان</strong><p>الإيصالات هنا وصلت إلى الخادم، لكنها تنتظر إجراءً قبل الترحيل. لا يُخصم المخزون ولا يضيع أي مبلغ منها.</p></div>
        <button type="button" className="refresh-button" onClick={() => { void load(); }} disabled={loading} aria-label="تحديث قائمة الإيصالات"><Icon name="refresh" size={19} /></button>
      </div>
      {err && <div className="inline-notice notice-warn" role="alert"><Icon name="alert" size={18} /><span>{err}</span><button className="text-button" onClick={() => { void load(); }}>إعادة المحاولة</button></div>}
      {loading && !data && <div className="loading-card"><span className="spinner" /> جارٍ فحص حالة المزامنة…</div>}
      {data && data.conflicts.length === 0 && <div className="empty-state success-empty"><span className="empty-icon success-empty-icon"><Icon name="circleCheck" size={27} /></span><strong>كل شيء متزامن</strong><span className="muted">لا توجد إيصالات تحتاج إلى مراجعة.</span></div>}
      {data?.conflicts.map((c) => <Card key={c.id} c={c} boot={boot} shifts={data.open_shifts} done={async () => { await load(); await reload(); }} />)}
    </div>
  );
}

function Card({ c, boot, shifts, done }: { c: Conflict; boot: Bootstrap; shifts: { id: string; opened_at: string }[]; done: () => Promise<void> }) {
  const mgr = boot.user.can_reverse;
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState('');
  const [shift, setShift] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const isCredit = /^CREDIT_LIMIT/.test(c.reason);
  const isShift = /^SHIFT_CLOSED/.test(c.reason);

  async function run(fn: () => Promise<unknown>, okText?: string) {
    setBusy(true);
    setMsg('');
    try { await fn(); if (okText) setMsg(okText); await done(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message + (e.detail ? ` (${e.detail.slice(0, 120)})` : '') : 'حدث خطأ غير متوقع.'); }
    finally { setBusy(false); }
  }
  const resolve = (body: object) => api<{ sync_status: string }>(`/sync-conflicts/${c.id}/resolve`, { body });
  const retry = () => run(async () => {
    const r = await resolve({ action: 'RETRY' });
    if (r.sync_status !== 'SYNCED') throw new ApiError(409, 'STILL', 'ما زال الإيصال معلّقًا؛ عالج السبب ثم أعد المحاولة.');
  }, 'تم ترحيل الإيصال بنجاح.');

  return (
    <article className="card pad conflict-card">
      <div className="conflict-card-head">
        <span className="conflict-symbol"><Icon name="alert" size={20} /></span>
        <div className="conflict-title"><span className="eyebrow">إيصال معلّق</span><strong dir="ltr">{c.offline_receipt_no}</strong></div>
        <span className="chip warn">{reasonAr(c.reason)}</span>
      </div>
      <div className="conflict-meta"><span><Icon name="user" size={15} />{c.cashier}</span>{c.customer && <span>العميل: {c.customer}</span>}<span><Icon name="clock" size={15} />{time(c.created_at)}</span></div>
      <ul className="conflict-lines">{c.lines.map((l, i) => <li key={i}><span>{l.item}</span><span>{money(l.qty)} × {money(l.unit_price)}</span></li>)}</ul>
      <div className="conflict-total"><span>الإجمالي <small>· {c.payments.map((p) => `${METHOD[p.method] ?? p.method} ${money(p.amount)}`).join(' + ')}</small></span><strong><bdi>{money(c.net_total)}</bdi> <small>ر.ي</small></strong></div>
      {mgr && <details className="tech"><summary>تفاصيل فنية</summary><code dir="ltr">{c.reason}</code></details>}
      {c.credit_approved && <p className="okbox compact-notice"><Icon name="circleCheck" size={17} /> وافق المدير على تجاوز السقف — أعد المحاولة لترحيل الإيصال.</p>}

      {panel === null && (
        <div className="actions conflict-actions">
          <button type="button" className="btn primary" disabled={busy} onClick={() => { void retry(); }}><Icon name="refresh" size={17} /> إعادة المحاولة</button>
          {mgr && isCredit && !c.credit_approved && <button type="button" className="btn" onClick={() => setPanel('override')}><Icon name="check" size={17} /> موافقة على التجاوز</button>}
          {mgr && isShift && <button type="button" className="btn" onClick={() => setPanel('move')}><Icon name="clock" size={17} /> نقل إلى وردية</button>}
          {mgr && <button type="button" className="btn danger" onClick={() => setPanel('reject')}><Icon name="close" size={17} /> رفض الإيصال</button>}
        </div>
      )}
      {panel && (
        <div className={`panel action-panel panel-${panel}`}>
          <div className="panel-title"><Icon name={panel === 'reject' ? 'alert' : panel === 'move' ? 'clock' : 'shieldCheck'} size={18} /><strong>{panel === 'override' ? 'موافقة المدير' : panel === 'reject' ? 'رفض الإيصال' : 'نقل إلى وردية أخرى'}</strong></div>
          {panel === 'reject' && <p className="muted small">سيُنقل الإيصال إلى قائمة الرفض على الجهاز. لن يُرحّل ولن يُخصم مخزونه.</p>}
          {panel === 'move' && <label>الوردية الهدف<select value={shift} onChange={(e) => setShift(e.target.value)}><option value="">اختر وردية مفتوحة…</option>{shifts.map((s) => <option key={s.id} value={s.id}>وردية فُتحت {time(s.opened_at)}</option>)}</select></label>}
          <label>السبب (مطلوب)<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اكتب ملاحظة مختصرة لتوثيق الإجراء" /></label>
          <div className="actions">
            <button type="button" className={`btn ${panel === 'reject' ? 'danger' : 'primary'}`} disabled={busy || !reason.trim() || (panel === 'move' && !shift)} onClick={() => { void run(async () => {
              if (panel === 'override') { await api(`/sales/${c.id}/credit-override`, { body: { reason } }); setPanel(null); setReason(''); await retry(); return; }
              if (panel === 'reject') await resolve({ action: 'REJECT', reason });
              if (panel === 'move') await resolve({ action: 'REASSIGN_SHIFT', reason, shift_id: shift });
            }); }}>{busy ? 'جارٍ التنفيذ…' : panel === 'override' ? 'موافقة ثم ترحيل' : panel === 'reject' ? 'تأكيد الرفض' : 'نقل وترحيل'}</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => setPanel(null)}>إلغاء</button>
          </div>
        </div>
      )}
      {msg && <p className={msg.startsWith('تم ') ? 'okbox compact-notice' : 'error conflict-error'} role={msg.startsWith('تم ') ? 'status' : 'alert'}>{msg}</p>}
      {!mgr && <p className="muted small manager-note">الرفض والموافقات ونقل الوردية من صلاحية المدير.</p>}
    </article>
  );
}
