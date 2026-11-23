import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bootstrap, Item, SaleBody } from '../api';
import { enqueue, flush, sent } from '../offline';
import { money, receiptNo, reasonAr, today, uuid } from '../format';
import Icon from '../components/Icon';

interface Pay { method: string; amount: string }
type Outcome = { kind: 'ok' | 'wait' | 'conflict' | 'fail'; text: string };

export default function Pos({ boot, setBoot }: { boot: Bootstrap; setBoot: (b: Bootstrap) => void }) {
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const byId = useMemo(() => Object.fromEntries(boot.items.map((i) => [i.id, i])), [boot.items]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? boot.items.filter((i) => i.name_ar.toLowerCase().includes(s) || i.item_code.toLowerCase().includes(s) || (i.barcode ?? '').includes(s)) : boot.items;
  }, [q, boot.items]);
  const lines = Object.entries(cart).map(([id, qty]) => ({ item: byId[id], qty })).filter((l) => l.item);
  const total = lines.reduce((s, l) => s + l.qty * Number(l.item.price), 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const add = (i: Item, d = 1) => setCart((c) => {
    const n = (c[i.id] ?? 0) + d;
    const { [i.id]: _, ...rest } = c;
    return n > 0 ? { ...rest, [i.id]: n } : rest;
  });
  function scan(e: React.FormEvent) { // Barcode scanners type a code and press Enter.
    e.preventDefault();
    const hit = boot.items.find((i) => i.barcode === q.trim() || i.item_code === q.trim());
    if (hit) { add(hit); setQ(''); }
  }

  async function finish(body: SaleBody) {
    await enqueue(body); // The receipt is durable on the phone before we confirm the sale.
    setBoot({ ...boot, items: boot.items.map((i) => {
      const line = body.lines.find((x) => x.item_id === i.id);
      return line ? { ...i, stock: String(Number(i.stock) - line.qty) } : i;
    }) });
    setCart({});
    setCheckout(false);
    void flush().then(() => {
      const result = sent().find((x) => x.receipt_no === body.receipt_no);
      if (result) setOutcome(result.sync_status === 'SYNCED'
        ? { kind: 'ok', text: `تم البيع بنجاح — فاتورة رقم ${result.invoice_no}` }
        : { kind: 'conflict', text: `حُفظ الإيصال لكنه معلّق: ${reasonAr(result.reason)}. راجع الإيصالات المعلّقة.` });
      else if (navigator.onLine) setOutcome({ kind: 'fail', text: 'لم يُرحَّل الإيصال. راجع قائمة الإيصالات المرفوضة في شاشة الوردية.' });
      else setOutcome({ kind: 'wait', text: 'حُفظ البيع على هذا الجهاز، وسيُرسل تلقائيًا عند عودة الاتصال.' });
    });
  }

  return (
    <div className="pos">
      <form onSubmit={scan} className="search-box" role="search">
        <span className="search-icon"><Icon name="search" size={20} /></span>
        <input type="search" inputMode="search" placeholder="ابحث بالاسم أو امسح الباركود" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث عن صنف أو مسح الباركود" />
        {q ? <button type="button" className="search-clear" onClick={() => setQ('')} aria-label="مسح البحث"><Icon name="close" size={17} /></button> : <span className="search-hint"><Icon name="scan" size={15} /> باركود أو اسم الصنف</span>}
      </form>

      {outcome && <div className={`banner ${outcome.kind}`} role="status" onClick={() => setOutcome(null)}>
        <span className="banner-icon"><Icon name={outcome.kind === 'ok' ? 'circleCheck' : outcome.kind === 'wait' ? 'wifiOff' : 'alert'} size={20} /></span>
        <span className="banner-message">{outcome.text}</span>
        <button className="banner-dismiss" onClick={(e) => { e.stopPropagation(); setOutcome(null); }} aria-label="إغلاق التنبيه"><Icon name="close" size={16} /></button>
      </div>}

      <div className="inventory-heading">
        <div><h2>الأصناف</h2><p className="muted">اختر صنفًا لإضافته مباشرةً إلى السلة.</p></div>
        <span className="result-count"><Icon name="package" size={15} />{shown.length} صنف</span>
      </div>
      <ul className="items">
        {shown.map((i) => {
          const inCart = cart[i.id] ?? 0;
          const low = Number(i.stock) <= 0;
          return (
            <li key={i.id}>
              <button type="button" className={`item ${inCart ? 'sel' : ''}`} onClick={() => add(i)} aria-pressed={inCart > 0} aria-label={`إضافة ${i.name_ar} إلى السلة، السعر ${money(i.price)} ريال`}>
                <span className="product-code" dir="ltr">{i.item_code}</span>
                {inCart > 0 && <span className="badge">{inCart}</span>}
                <span className="nm">{i.name_ar}</span>
                <span className="product-price"><span>سعر الوحدة</span><bdi><strong>{money(i.price)}</strong><small> ر.ي</small></bdi></span>
                <span className="product-bottom">
                  <span className={`stock-tag ${low ? 'out' : ''}`}><Icon name={low ? 'alert' : 'package'} size={14} />{low ? 'نفد المخزون' : `المتاح ${money(i.stock)}`}</span>
                  <span className="add-indicator" aria-hidden="true"><Icon name={inCart ? 'check' : 'plus'} size={18} /></span>
                </span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="empty-state empty-products"><span className="empty-icon"><Icon name="search" size={24} /></span><strong>لم نعثر على هذا الصنف</strong><span className="muted">تحقق من الاسم أو امسح الباركود مرة أخرى.</span></li>}
      </ul>

      {count > 0 && (
        <button type="button" className="cartbar" onClick={() => setCheckout(true)} aria-label={`فتح السلة، ${count} صنف، الإجمالي ${money(total)} ريال`}>
          <span className="cartbar-copy"><span className="cartbar-icon"><Icon name="cart" size={21} /></span><span><strong>السلة جاهزة</strong><small>{count} {count === 1 ? 'صنف' : 'أصناف'}</small></span></span>
          <span className="cartbar-total"><small>الإجمالي</small><strong><bdi>{money(total)}</bdi><small> ر.ي</small></strong></span>
          <span className="cartbar-cta">متابعة <Icon name="arrowLeft" size={18} /></span>
        </button>
      )}
      {checkout && <Checkout boot={boot} lines={lines} total={total} add={add} onClose={() => setCheckout(false)} onDone={finish} />}
    </div>
  );
}

function Checkout({ boot, lines, total, add, onClose, onDone }: {
  boot: Bootstrap; lines: { item: Item; qty: number }[]; total: number; add: (i: Item, d?: number) => void; onClose: () => void; onDone: (b: SaleBody) => void | Promise<void>;
}) {
  const [pays, setPays] = useState<Pay[]>([{ method: 'CASH', amount: String(total) }]);
  const [customer, setCustomer] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const submittingRef = useRef(submitBusy);
  closeRef.current = onClose;
  submittingRef.current = submitBusy;
  useEffect(() => {
    const sheet = sheetRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => sheet?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab' || !sheet) return;
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) { event.preventDefault(); sheet.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const rest = Math.round((total - paid) * 100) / 100;
  const hasCredit = pays.some((p) => p.method === 'CREDIT');
  const cust = boot.customers.find((c) => c.id === customer);
  const creditAmt = pays.filter((p) => p.method === 'CREDIT').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const overLimit = !!cust && Number(cust.credit_limit) > 0 && Number(cust.balance) + creditAmt > Number(cust.credit_limit);
  const ok = lines.length > 0 && rest === 0 && pays.every((p) => Number(p.amount) > 0) && (!hasCredit || !!customer);
  const used = new Set(pays.map((p) => p.method));


  function setPay(i: number, patch: Partial<Pay>) {
    setPays((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  }

  function changeQuantity(item: Item, delta: number) {
    if (pays.length === 1 && pays[0].method === 'CASH' && Number(pays[0].amount) === total) {
      setPays([{ ...pays[0], amount: String(Math.max(0, total + delta * Number(item.price))) }]);
    }
    add(item, delta);
  }

  async function submit() {
    if (submitBusy || !ok) return;
    setSubmitBusy(true);
    setSubmitError('');
    try {
      await onDone({
        offline_uuid: uuid(), receipt_no: receiptNo(), invoice_date: today(), shift_id: boot.shift!.id, customer_id: hasCredit ? customer : null,
        lines: lines.map((l) => ({ item_id: l.item.id, unit_id: l.item.unit_id, qty: l.qty, unit_price: Number(l.item.price) })),
        payments: pays.map((p) => ({ payment_method: p.method, amount: Number(p.amount) })),
      });
    } catch {
      setSubmitError('تعذّر حفظ الإيصال على هذا الجهاز. حاول مرة أخرى.');
      setSubmitBusy(false);
    }
  }

  return (
    <div className="sheet-back" onClick={() => { if (!submitBusy) onClose(); }}>
      <div ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby="checkout-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <div><span className="eyebrow">مراجعة الطلب</span><h2 id="checkout-title">إتمام البيع</h2></div>
          <button type="button" className="sheet-close" onClick={onClose} disabled={submitBusy} aria-label="إغلاق نافذة الدفع"><Icon name="close" size={19} /></button>
        </div>

        <div className="checkout-section-head"><h3>الأصناف</h3><span>{lines.length} صنف</span></div>
        <ul className="clines checkout-lines">
          {lines.map((l) => (
            <li key={l.item.id}>
              <span className="checkout-item-name"><strong>{l.item.name_ar}</strong><small>{money(l.item.price)} ر.ي للوحدة</small></span>
              <span className="qty">
                <button type="button" aria-label={`إنقاص ${l.item.name_ar}`} onClick={() => changeQuantity(l.item, -1)}><Icon name="minus" size={16} /></button>
                <b>{l.qty}</b>
                <button type="button" aria-label={`زيادة ${l.item.name_ar}`} onClick={() => changeQuantity(l.item, 1)}><Icon name="plus" size={16} /></button>
              </span>
              <span className="sum"><bdi>{money(l.qty * Number(l.item.price))}</bdi></span>
            </li>
          ))}
        </ul>
        <div className="total checkout-total"><span>الإجمالي</span><strong><bdi>{money(total)}</bdi> <small>ر.ي</small></strong></div>

        <section className="payment-section">
          <div className="checkout-section-head"><h3>طريقة الدفع</h3><span>يمكن تقسيم المبلغ</span></div>
          {pays.map((p, i) => (
            <div className="payrow" key={i}>
              <label className="visually-hidden" htmlFor={`payment-method-${i}`}>طريقة الدفع {i + 1}</label>
              <select id={`payment-method-${i}`} value={p.method} onChange={(e) => setPay(i, { method: e.target.value })}>
                {boot.methods.map((m) => <option key={m.method} value={m.method} disabled={used.has(m.method) && m.method !== p.method}>{m.label_ar}</option>)}
              </select>
              <label className="visually-hidden" htmlFor={`payment-amount-${i}`}>المبلغ {i + 1}</label>
              <input id={`payment-amount-${i}`} className="numeric-input" inputMode="decimal" value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value.replace(/[^\d.]/g, '') })} />
              {pays.length > 1 && <button type="button" className="remove-pay" onClick={() => setPays(pays.filter((_, k) => k !== i))} aria-label="حذف طريقة الدفع"><Icon name="trash" size={17} /></button>}
            </div>
          ))}
          {pays.length < boot.methods.length && <button type="button" className="add-payment" onClick={() => setPays([...pays, { method: boot.methods.find((m) => !used.has(m.method))!.method, amount: String(Math.max(rest, 0)) }])}><Icon name="plus" size={16} /> إضافة طريقة دفع أخرى</button>}
          {rest !== 0 && <p className="payment-balance" role="status"><Icon name="alert" size={17} />{rest > 0 ? `المتبقي ${money(rest)} ر.ي` : `المبلغ الزائد ${money(-rest)} ر.ي`}</p>}
        </section>

        {hasCredit && (
          <div className="credit-section">
            <label>العميل (للبيع الآجل)
              <select value={customer} onChange={(e) => setCustomer(e.target.value)}>
                <option value="">اختر العميل…</option>
                {boot.customers.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </label>
            {boot.customers.length === 0 && <p className="muted small">لا يوجد عملاء متاحون للبيع الآجل.</p>}
            {cust && <p className={overLimit ? 'credit-warning' : 'credit-note'}>
              الرصيد الحالي {money(cust.balance)} · {Number(cust.credit_limit) > 0 ? `السقف ${money(cust.credit_limit)}` : 'بلا سقف'}
              {overLimit && ' — سيتجاوز السقف وسيُعلَّق الإيصال حتى موافقة المدير'}
            </p>}
          </div>
        )}
        {submitError && <p className="error" role="alert">{submitError}</p>}
        <button type="button" className="btn primary big checkout-submit" disabled={!ok || submitBusy} onClick={() => { void submit(); }}>
          {submitBusy ? 'جارٍ حفظ الإيصال…' : `تأكيد البيع — ${money(total)} ر.ي`}
          {!submitBusy && <Icon name="arrowLeft" size={19} />}
        </button>
        <p className="checkout-safety"><Icon name="shieldCheck" size={15} /> يُحفظ الإيصال على الجهاز قبل إرساله للخادم.</p>
      </div>
    </div>
  );
}
