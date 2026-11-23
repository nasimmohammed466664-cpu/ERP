import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Bootstrap, type InvoiceDetail, type InvoiceRow } from '../api';
import { money, time, uuid } from '../format';
import Icon from '../components/Icon';

const METHOD: Record<string, string> = { CASH: 'نقدًا', CREDIT: 'آجل', JAIB: 'جيب', JAWALI: 'جوالي', ONECASH: 'ون كاش', KURAIMI: 'الكريمي' };

export default function Invoices({ boot, offline }: { boot: Bootstrap; offline: boolean }) {
  const [rows, setRows] = useState<InvoiceRow[] | null>(null);
  const [no, setNo] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await api<InvoiceRow[]>('/invoices' + (no.trim() ? `?no=${encodeURIComponent(no.trim())}` : '')));
      setErr('');
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 0 ? 'البحث في الفواتير يحتاج اتصالًا بالخادم.' : 'تعذّر تحميل الفواتير. حاول مرة أخرى.');
    }
  }, [no]);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 250); return () => clearTimeout(t); }, [load]);

  if (open) return <Detail id={open} boot={boot} offline={offline} back={() => { setOpen(null); void load(); }} onDone={(m) => { setFlash(m); setOpen(null); void load(); }} />;

  return (
    <div className="stack invoice-screen">
      <div className="search-box invoice-search" role="search">
        <span className="search-icon"><Icon name="search" size={20} /></span>
        <input type="search" inputMode="numeric" placeholder="اكتب رقم الفاتورة" value={no} onChange={(e) => setNo(e.target.value.replace(/\D/g, ''))} aria-label="بحث برقم الفاتورة" />
        {no && <button type="button" className="search-clear" onClick={() => setNo('')} aria-label="مسح البحث"><Icon name="close" size={17} /></button>}
      </div>
      <div className="invoice-list-heading">
        <div><h2>سجل الفواتير</h2><p className="muted">افتح أي فاتورة لعرض تفاصيلها والإجراءات المتاحة.</p></div>
        {rows && <span className="result-count"><Icon name="receipt" size={15} />{rows.length} فاتورة</span>}
      </div>
      {flash && <div className="banner ok" role="status"><span className="banner-icon"><Icon name="circleCheck" size={20} /></span><span className="banner-message">{flash}</span><button className="banner-dismiss" onClick={() => setFlash('')} aria-label="إغلاق التنبيه"><Icon name="close" size={16} /></button></div>}
      {err && <div className="inline-notice notice-warn" role="alert"><Icon name="alert" size={18} /><span>{err}</span><button className="text-button" onClick={() => { void load(); }}>إعادة المحاولة</button></div>}
      {!rows && !err && <div className="loading-card"><span className="spinner" /> جارٍ تحميل الفواتير…</div>}
      {rows && rows.length === 0 && <div className="empty-state"><span className="empty-icon"><Icon name="receipt" size={25} /></span><strong>{no ? 'لا توجد فاتورة بهذا الرقم' : 'لا توجد فواتير بعد'}</strong><span className="muted">{no ? 'تأكد من الرقم وحاول مرة أخرى.' : 'ستظهر الفواتير المسجّلة هنا.'}</span></div>}
      <ul className="inv">
        {rows?.map((r) => (
          <li key={r.id}>
            <button type="button" className="card invrow" onClick={() => setOpen(r.id)} aria-label={`عرض الفاتورة رقم ${r.invoice_no}`}>
              <span className="invoice-row-main">
                <span className="invoice-row-title"><b>فاتورة <bdi>#{r.invoice_no}</bdi></b>{r.customer && <span className="muted">{r.customer}</span>}</span>
                <span className="invoice-metadata"><span>{r.invoice_date}</span><span aria-hidden="true">·</span><span>{time(r.created_at)}</span></span>
              </span>
              <span className="invoice-row-side"><strong><bdi>{money(r.net_total)}</bdi><small> ر.ي</small></strong>
                {r.reversed ? <span className="chip danger-chip">ملغاة</span> : Number(r.returned_total) > 0 ? <span className="chip info">مرتجع {money(r.returned_total)}</span> : <span className="chip success-chip">مكتملة</span>}
              </span>
              <span className="invoice-open-icon"><Icon name="chevronLeft" size={18} /></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ id, boot, offline, back, onDone }: { id: string; boot: Bootstrap; offline: boolean; back: () => void; onDone: (m: string) => void }) {
  const [d, setD] = useState<InvoiceDetail | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState('CASH');
  const [mode, setMode] = useState<'view' | 'reverse'>('view');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const requestId = useRef(uuid()); // A retry or double tap cannot refund twice.

  useEffect(() => { void api<InvoiceDetail>(`/invoices/${id}`).then(setD).catch((e) => setErr(e instanceof ApiError ? e.message : 'تعذّر تحميل الفاتورة.')); }, [id]);
  if (!d) return <div className="stack"><button type="button" className="btn ghost back-button" onClick={back}><Icon name="arrowLeft" size={17} /> العودة إلى الفواتير</button>{err ? <p className="error" role="alert">{err}</p> : <div className="loading-card"><span className="spinner" /> جارٍ تحميل تفاصيل الفاتورة…</div>}</div>;

  const left = (l: InvoiceDetail['lines'][number]) => Number(l.qty) - Number(l.returned_qty);
  const chosen = d.lines.filter((l) => (qty[l.id] ?? 0) > 0);
  const total = Math.round(chosen.reduce((s, l) => s + (qty[l.id] ?? 0) * l.refund_price, 0) * 10000) / 10000;
  const canAct = d.returnable && !d.reversed;
  const methods = boot.methods.filter((m) => m.method !== 'CREDIT' || d.has_customer);

  async function doReturn() {
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ invoice_no: number; net_total: string }>(`/invoices/${id}/return`, { body: {
        request_id: requestId.current, shift_id: boot.shift!.id,
        lines: chosen.map((l) => ({ original_line_id: l.id, qty: qty[l.id] })), payments: [{ payment_method: method, amount: total }],
      } });
      onDone(`تم المرتجع — مستند رقم ${r.invoice_no} بقيمة ${money(r.net_total)} ر.ي (${METHOD[method]})`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message + (e.detail ? ` — ${e.detail.slice(0, 140)}` : '') : 'حدث خطأ غير متوقع.');
    } finally {
      setBusy(false);
    }
  }

  async function doReverse() {
    setBusy(true);
    setErr('');
    try {
      await api(`/invoices/${id}/reverse`, { body: { reason } });
      onDone(`أُلغيت الفاتورة رقم ${d!.invoice_no} وأُعيد المخزون والنقد.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message + (e.detail ? ` — ${e.detail.slice(0, 140)}` : '') : 'حدث خطأ غير متوقع.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack invoice-detail">
      <button type="button" className="btn ghost back-button" onClick={back}><Icon name="arrowLeft" size={17} /> العودة إلى الفواتير</button>
      {err && <div className="inline-notice notice-warn" role="alert"><Icon name="alert" size={18} /><span>{err}</span></div>}
      <section className="card pad invoice-detail-card">
        <div className="invoice-detail-head">
          <span className="invoice-detail-icon"><Icon name="receipt" size={22} /></span>
          <div><span className="eyebrow">تفاصيل الفاتورة</span><h2>رقم <bdi>{d.invoice_no}</bdi></h2></div>
          {d.reversed ? <span className="chip danger-chip">ملغاة</span> : <span className="chip success-chip">مسجّلة</span>}
        </div>
        <div className="invoice-meta-grid">
          <div><span>التاريخ</span><strong>{d.invoice_date}</strong></div>
          <div><span>العميل</span><strong>{d.customer ?? 'عميل نقدي'}</strong></div>
          <div className="invoice-payment-meta"><span>طريقة الدفع</span><strong>{d.payments.map((p) => `${METHOD[p.method] ?? p.method} ${money(p.amount)}`).join(' + ')}</strong></div>
        </div>
        <div className="detail-lines-heading"><h3>الأصناف</h3><span>{d.lines.length} صنف</span></div>
        <ul className="clines invoice-lines">
          {d.lines.map((l) => (
            <li key={l.id} className="invoice-line">
              <span className="nm"><strong>{l.item}</strong><small>مباع {money(l.qty)} · مرتجع {money(l.returned_qty)} · سعر الرد {money(l.refund_price)}</small></span>
              {canAct && left(l) > 0 ? (
                <span className="qty"><button type="button" aria-label={`إنقاص كمية ${l.item}`} onClick={() => setQty({ ...qty, [l.id]: Math.max((qty[l.id] ?? 0) - 1, 0) })}><Icon name="minus" size={16} /></button><b>{qty[l.id] ?? 0}</b>
                  <button type="button" aria-label={`زيادة كمية ${l.item}`} onClick={() => setQty({ ...qty, [l.id]: Math.min((qty[l.id] ?? 0) + 1, left(l)) })}><Icon name="plus" size={16} /></button></span>
              ) : <span className="muted small">{left(l) <= 0 ? 'أُرجع كاملًا' : ''}</span>}
            </li>
          ))}
        </ul>
        <div className="total invoice-total"><span>إجمالي الفاتورة</span><strong><bdi>{money(d.net_total)}</bdi> <small>ر.ي</small></strong></div>
      </section>

      {!d.returnable && !d.reversed && <p className="inline-notice notice-info"><Icon name="alert" size={18} /> مرتجع الفواتير الضريبية غير مدعوم حاليًا.</p>}
      {canAct && (
        <section className="card pad action-card">
          <div className="section-title-row"><span className="action-icon"><Icon name="rotate" size={19} /></span><div><h2>إرجاع أصناف</h2><p className="muted">حدّد الكمية وطريقة رد المبلغ.</p></div></div>
          {!boot.shift && <p className="inline-notice notice-warn"><Icon name="alert" size={18} /> افتح وردية أولًا لتسجيل المرتجع.</p>}
          <label>طريقة رد المبلغ<select value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((m) => <option key={m.method} value={m.method}>{m.label_ar}</option>)}</select></label>
          {method === 'CREDIT' && <p className="muted small">يُخصم المبلغ من رصيد العميل.</p>}
          {method === 'CASH' && <p className="muted small">يخرج النقد من درج الوردية الحالية.</p>}
          {offline && <p className="inline-notice notice-warn"><Icon name="wifiOff" size={18} /> يلزم الاتصال بالإنترنت لتسجيل المرتجع.</p>}
          <button type="button" className="btn primary big" disabled={busy || offline || !boot.shift || chosen.length === 0} onClick={() => { void doReturn(); }}>
            {busy ? 'جارٍ تسجيل المرتجع…' : chosen.length ? `تأكيد المرتجع — ${money(total)} ر.ي` : 'اختر الكميات المرتجعة'}
          </button>
        </section>
      )}

      {boot.user.can_reverse && !d.reversed && (
        <section className="card pad reverse-card">
          <div className="section-title-row"><span className="action-icon danger-icon"><Icon name="alert" size={19} /></span><div><h2>إلغاء الفاتورة كاملة</h2><p className="muted">إجراء إداري يعكس حركة المخزون والنقد.</p></div></div>
          {Number(d.returned_total) > 0 ? <p className="inline-notice notice-info">عليها مرتجعات مرحّلة، ولا يمكن إلغاؤها قبل إلغاء المرتجعات.</p> : mode === 'view'
            ? <button type="button" className="btn danger" onClick={() => setMode('reverse')}>إلغاء الفاتورة…</button>
            : <>
                <label>سبب الإلغاء (مطلوب)<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                <div className="actions"><button type="button" className="btn danger" disabled={busy || offline || !reason.trim()} onClick={() => { void doReverse(); }}>{busy ? 'جارٍ الإلغاء…' : 'تأكيد الإلغاء'}</button><button type="button" className="btn ghost" onClick={() => setMode('view')}>تراجع</button></div>
              </>}
        </section>
      )}
    </div>
  );
}
