import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Bootstrap } from '../api';
import { failed, flush, queue, dismissFailed, sent, total, type Failed } from '../offline';
import { money, reasonAr, time, today } from '../format';
import Icon from '../components/Icon';

interface Report {
  status: string; opening_float: string; net_cash_sales: string | null; cash_receipts: string | null; cash_payments: string | null; petty_cash: string | null;
  expected_cash: string | null; counted_cash: string | null; variance: string | null; wallets: Record<string, string>; credit_sales: string; blind?: boolean;
}
const WALLET: Record<string, string> = { JAIB: 'جيب', JAWALI: 'جوالي', ONECASH: 'ون كاش', KURAIMI: 'الكريمي', BANK_TRANSFER: 'تحويل بنكي' };

export default function Shift({ boot, reload }: { boot: Bootstrap; reload: () => Promise<void> }) {
  const shift = boot.shift;
  const [rep, setRep] = useState<Report | null>(null);
  const [counted, setCounted] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const fails: Failed[] = failed();
  const pendingCount = queue().length;

  const load = useCallback(async () => {
    if (!shift) return;
    try { setRep(await api<Report>(`/shifts/${shift.id}/report`)); } catch { /* Keep a previously loaded report if the phone goes offline. */ }
  }, [shift]);
  useEffect(() => {
    void load();
    const f = () => tick((n) => n + 1);
    window.addEventListener('erp:queue', f);
    return () => window.removeEventListener('erp:queue', f);
  }, [load]);

  async function close() {
    if (!shift) return;
    setBusy(true);
    setMsg(null);
    try {
      await flush();
      if (queue().length) {
        setMsg({ kind: 'error', text: `يوجد ${queue().length} إيصال لم يُرسل بعد. اتصل بالإنترنت ثم أعد المحاولة.` });
        return;
      }
      const r = await api<{ variance: string }>(`/shifts/${shift.id}/close`, { body: { counted_cash: Number(counted), date: today() } });
      const v = Number(r.variance);
      setMsg({ kind: 'ok', text: v === 0 ? 'أُغلقت الوردية والعدّ مطابق تمامًا.' : `أُغلقت الوردية. ${v > 0 ? 'زيادة' : 'عجز'} قدره ${money(Math.abs(v))} ر.ي.` });
      await reload();
    } catch (x) {
      setMsg({ kind: 'error', text: x instanceof ApiError ? x.message : 'حدث خطأ غير متوقع.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack shift-screen">
      {!shift && <div className="empty-state"><span className="empty-icon"><Icon name="clock" size={25} /></span><strong>لا توجد وردية مفتوحة</strong><span className="muted">افتح وردية من شاشة البيع لبدء تسجيل الحركات.</span></div>}
      {shift && (
        <>
          <section className="card pad report-card">
            <div className="section-title-row report-title-row"><span className="action-icon"><Icon name="chart" size={20} /></span><div><h2>ملخص الوردية</h2><p className="muted">بدأت {time(shift.opened_at)}</p></div><span className="chip success-chip">مفتوحة</span></div>
            {rep ? (
              <>
                <div className="report-stats">
                  <div className="report-stat"><span>العهدة الافتتاحية</span><strong><bdi>{money(rep.opening_float)}</bdi><small> ر.ي</small></strong></div>
                  <div className="report-stat"><span>مبيعات نقدية</span><strong><bdi>{money(rep.net_cash_sales)}</bdi><small> ر.ي</small></strong></div>
                  <div className={`report-stat report-highlight ${rep.blind ? 'blind-stat' : ''}`}><span>النقد المتوقع</span><strong>{rep.blind ? 'مخفي' : <><bdi>{money(rep.expected_cash)}</bdi><small> ر.ي</small></>}</strong>{rep.blind && <small>عدّ أعمى مفعّل</small>}</div>
                </div>
                <div className="report-secondary">
                  <dl className="kv">
                    {Object.entries(rep.wallets).map(([k, v]) => <div className="kv-row" key={k}><dt>{WALLET[k] ?? k}</dt><dd><bdi>{money(v)}</bdi> ر.ي</dd></div>)}
                    <div className="kv-row"><dt>مبيعات آجلة</dt><dd><bdi>{money(rep.credit_sales)}</bdi> ر.ي</dd></div>
                  </dl>
                </div>
              </>
            ) : <p className="inline-notice notice-info"><Icon name="wifiOff" size={18} /> التقرير غير متاح دون اتصال.</p>}
          </section>

          <section className="card pad close-shift-card">
            <div className="section-title-row"><span className="action-icon"><Icon name="wallet" size={20} /></span><div><h2>إغلاق الوردية</h2><p className="muted">عدّ النقد في الدرج وأدخل الإجمالي الفعلي.</p></div></div>
            {pendingCount > 0 && <p className="inline-notice notice-warn"><Icon name="refresh" size={18} /> لديك {pendingCount} إيصال بانتظار الإرسال. سنحاول مزامنتها قبل الإغلاق.</p>}
            <label className="money-label">النقد الفعلي في الدرج بعد العدّ
              <span className="money-field"><input className="numeric-input" type="text" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" aria-label="مبلغ النقد الفعلي في الدرج" /><span className="currency">ر.ي</span></span>
            </label>
            {msg && <p className={`inline-notice ${msg.kind === 'ok' ? 'notice-success' : 'notice-warn'}`} role="status"><Icon name={msg.kind === 'ok' ? 'circleCheck' : 'alert'} size={18} />{msg.text}</p>}
            <button type="button" className="btn primary close-shift-button" disabled={busy || counted === ''} onClick={() => { void close(); }}>
              {busy ? 'جارٍ إغلاق الوردية…' : 'تأكيد إغلاق الوردية'}{!busy && <Icon name="arrowLeft" size={18} />}
            </button>
          </section>
        </>
      )}

      {fails.length > 0 && (
        <section className="card pad failed-card">
          <div className="section-title-row"><span className="action-icon danger-icon"><Icon name="alert" size={20} /></span><div><h2>إيصالات رفضها الخادم</h2><p className="muted">لم تُرحّل ولم يُخصم لها مخزون.</p></div><span className="chip danger-chip">{fails.length}</span></div>
          <ul className="failed-list">{fails.map((f) => (
            <li key={f.body.offline_uuid}>
              <div className="failed-receipt-main"><strong dir="ltr">{f.body.receipt_no}</strong><bdi>{money(total(f.body))} ر.ي</bdi></div>
              <span className="failed-message">{f.message}</span>
              <button type="button" className="text-button remove-failed" onClick={() => { void dismissFailed(f.body.offline_uuid); }}><Icon name="trash" size={15} /> إزالة من القائمة</button>
            </li>))}
          </ul>
        </section>
      )}
      <section className="card pad history-card">
        <div className="section-title-row"><span className="action-icon"><Icon name="receipt" size={20} /></span><div><h2>آخر الإيصالات</h2><p className="muted">آخر عمليات البيع على هذا الجهاز.</p></div></div>
        <ul className="history-list">
          {sent().slice(0, 8).map((s) => (
            <li key={s.receipt_no}>
              <span className="history-icon"><Icon name={s.sync_status === 'SYNCED' ? 'circleCheck' : 'refresh'} size={18} /></span>
              <span className="history-info"><strong><bdi>{s.invoice_no ? `#${s.invoice_no}` : s.receipt_no}</bdi></strong><small>{time(s.at)}{s.sync_status !== 'SYNCED' ? ` · ${reasonAr(s.reason)}` : ' · تم الإرسال'}</small></span>
              <strong className="history-total"><bdi>{money(s.total)}</bdi><small> ر.ي</small></strong>
            </li>))}
          {sent().length === 0 && <li className="history-empty muted">ستظهر الإيصالات بعد أول عملية بيع.</li>}
        </ul>
      </section>
    </div>
  );
}
