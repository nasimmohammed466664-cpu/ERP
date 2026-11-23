import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Bootstrap, type InvoiceDetail, type InvoiceRow } from '../api';
import { money, time, uuid } from '../format';

const METHOD: Record<string, string> = { CASH: 'نقدًا', CREDIT: 'آجل', JAIB: 'جيب', JAWALI: 'جوالي', ONECASH: 'ون كاش', KURAIMI: 'الكريمي' };

export default function Invoices({ boot, offline }: { boot: Bootstrap; offline: boolean }) {
  const [rows, setRows] = useState<InvoiceRow[] | null>(null);
  const [no, setNo] = useState(''); const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    try { setRows(await api<InvoiceRow[]>('/invoices' + (no.trim() ? `?no=${encodeURIComponent(no.trim())}` : ''))); setErr(''); }
    catch (e) { setErr(e instanceof ApiError && e.status === 0 ? 'البحث في الفواتير يحتاج اتصالًا بالخادم.' : 'تعذّر التحميل'); }
  }, [no]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  if (open) return <Detail id={open} boot={boot} offline={offline} back={() => { setOpen(null); load(); }} onDone={(m) => { setFlash(m); setOpen(null); load(); }} />;
  return (
    <div className="stack">
      <input type="search" inputMode="numeric" placeholder="رقم الفاتورة" value={no} onChange={(e) => setNo(e.target.value.replace(/\D/g, ''))} aria-label="بحث برقم الفاتورة" />
      {flash && <div className="banner ok" role="status" onClick={() => setFlash('')}>{flash}<span className="x">إغلاق</span></div>}
      {err && <p className="error">{err}</p>}
      {rows && rows.length === 0 && <div className="card pad center muted">لا توجد فواتير مطابقة.</div>}
      <ul className="inv">
        {rows?.map((r) => (
          <li key={r.id}><button className="card pad invrow" onClick={() => setOpen(r.id)}>
            <span><b><bdi>#{r.invoice_no}</bdi></b>{r.customer && <span className="muted"> · {r.customer}</span>}<br /><span className="muted small">{r.invoice_date} · {time(r.created_at)}</span></span>
            <span className="end"><b>{money(r.net_total)}</b>
              {r.reversed && <span className="chip warn">ملغاة</span>}
              {!r.reversed && Number(r.returned_total) > 0 && <span className="chip info">مرتجع {money(r.returned_total)}</span>}</span>
          </button></li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ id, boot, offline, back, onDone }: { id: string; boot: Bootstrap; offline: boolean; back: () => void; onDone: (m: string) => void }) {
  const [d, setD] = useState<InvoiceDetail | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState('CASH');
  const [mode, setMode] = useState<'view' | 'reverse'>('view'); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const requestId = useRef(uuid());                        // one id per opened screen: a double tap or a retry can never refund twice

  useEffect(() => { api<InvoiceDetail>(`/invoices/${id}`).then(setD).catch((e) => setErr(e instanceof ApiError ? e.message : 'خطأ')); }, [id]);
  if (!d) return <div className="stack"><button className="btn ghost" onClick={back}>رجوع</button>{err ? <p className="error">{err}</p> : <p className="muted center">جارٍ التحميل…</p>}</div>;

  const left = (l: InvoiceDetail['lines'][number]) => Number(l.qty) - Number(l.returned_qty);
  const chosen = d.lines.filter((l) => (qty[l.id] ?? 0) > 0);
  const total = Math.round(chosen.reduce((s, l) => s + (qty[l.id] ?? 0) * l.refund_price, 0) * 10000) / 10000;
  const canAct = d.returnable && !d.reversed;
  const methods = boot.methods.filter((m) => m.method !== 'CREDIT' || d.has_customer);

  async function doReturn() {
    setBusy(true); setErr('');
    try {
      const r = await api<{ invoice_no: number; net_total: string }>(`/invoices/${id}/return`, { body: {
        request_id: requestId.current, shift_id: boot.shift!.id,
        lines: chosen.map((l) => ({ original_line_id: l.id, qty: qty[l.id] })), payments: [{ payment_method: method, amount: total }] } });
      onDone(`تم المرتجع — مستند رقم ${r.invoice_no} بقيمة ${money(r.net_total)} ر.ي (${METHOD[method]})`);
    } catch (e) { setErr(e instanceof ApiError ? e.message + (e.detail ? ` — ${e.detail.slice(0, 140)}` : '') : 'خطأ'); } finally { setBusy(false); }
  }
  async function doReverse() {
    setBusy(true); setErr('');
    try { await api(`/invoices/${id}/reverse`, { body: { reason } }); onDone(`أُلغيت الفاتورة رقم ${d!.invoice_no} وأُعيد المخزون والنقد.`); }
    catch (e) { setErr(e instanceof ApiError ? e.message + (e.detail ? ` — ${e.detail.slice(0, 140)}` : '') : 'خطأ'); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <button className="btn ghost" onClick={back}>رجوع إلى الفواتير</button>
      <div className="card pad">
        <div className="row"><h2>فاتورة رقم <bdi>{d.invoice_no}</bdi></h2>{d.reversed && <span className="chip warn">ملغاة</span>}</div>
        <p className="muted small">{d.invoice_date}{d.customer ? ` · ${d.customer}` : ''} · {d.payments.map((p) => `${METHOD[p.method] ?? p.method} ${money(p.amount)}`).join(' + ')}</p>
        <ul className="clines">
          {d.lines.map((l) => (
            <li key={l.id} className="rline">
              <span className="nm">{l.item}<br /><span className="muted small">بيع {money(l.qty)} · أُرجع {money(l.returned_qty)} · سعر الرد {money(l.refund_price)}</span></span>
              {canAct && left(l) > 0 ? (
                <span className="qty"><button aria-label="إنقاص" onClick={() => setQty({ ...qty, [l.id]: Math.max((qty[l.id] ?? 0) - 1, 0) })}>−</button><b>{qty[l.id] ?? 0}</b>
                  <button aria-label="زيادة" onClick={() => setQty({ ...qty, [l.id]: Math.min((qty[l.id] ?? 0) + 1, left(l)) })}>+</button></span>
              ) : <span className="muted small">{left(l) <= 0 ? 'أُرجع كاملًا' : ''}</span>}
            </li>
          ))}
        </ul>
        <div className="total"><span>الإجمالي</span><strong>{money(d.net_total)} ر.ي</strong></div>
      </div>

      {!d.returnable && !d.reversed && <p className="muted">مرتجع الفواتير الضريبية غير مدعوم بعد.</p>}
      {canAct && (
        <div className="card pad">
          <h2>إرجاع أصناف</h2>
          {!boot.shift && <p className="error">افتح وردية أولًا لتسجيل المرتجع.</p>}
          <label>طريقة رد المبلغ<select value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((m) => <option key={m.method} value={m.method}>{m.label_ar}</option>)}</select></label>
          {method === 'CREDIT' && <p className="muted small">يُخصم المبلغ من رصيد العميل.</p>}
          {method === 'CASH' && <p className="muted small">يخرج النقد من درج وردية {boot.shift ? 'الحالية' : ''}.</p>}
          {offline && <p className="error">المرتجع يحتاج اتصالًا بالخادم.</p>}
          <button className="btn primary big" disabled={busy || offline || !boot.shift || chosen.length === 0} onClick={doReturn}>{chosen.length ? `تأكيد المرتجع — ${money(total)} ر.ي` : 'اختر الكميات المرتجعة'}</button>
        </div>
      )}

      {boot.user.can_reverse && !d.reversed && (
        <div className="card pad">
          <h2>إلغاء الفاتورة كاملة</h2>
          {Number(d.returned_total) > 0 ? <p className="muted">عليها مرتجعات مرحّلة، ولا يمكن إلغاؤها قبل إلغاء المرتجعات.</p> : mode === 'view'
            ? <button className="btn danger" onClick={() => setMode('reverse')}>إلغاء الفاتورة…</button>
            : <>
                <label>سبب الإلغاء (مطلوب)<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                <div className="actions"><button className="btn danger" disabled={busy || offline || !reason.trim()} onClick={doReverse}>تأكيد الإلغاء</button><button className="btn ghost" onClick={() => setMode('view')}>تراجع</button></div>
              </>}
        </div>
      )}
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  );
}
