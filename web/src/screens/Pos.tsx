import { useMemo, useState } from 'react';
import type { Bootstrap, Item, SaleBody } from '../api';
import { enqueue, flush, sent } from '../offline';
import { money, receiptNo, reasonAr, today, uuid } from '../format';

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

  const add = (i: Item, d = 1) => setCart((c) => { const n = (c[i.id] ?? 0) + d; const { [i.id]: _, ...rest } = c; return n > 0 ? { ...rest, [i.id]: n } : rest; });
  function scan(e: React.FormEvent) {         // a hardware/phone barcode keyboard types the code then presses Enter
    e.preventDefault();
    const hit = boot.items.find((i) => i.barcode === q.trim() || i.item_code === q.trim());
    if (hit) { add(hit); setQ(''); }
  }

  async function finish(body: SaleBody) {
    await enqueue(body);          // durable on the phone before we say anything
    // local stock view so the next sale on an offline phone is realistic (the server stays the judge)
    setBoot({ ...boot, items: boot.items.map((i) => { const l = body.lines.find((x) => x.item_id === i.id); return l ? { ...i, stock: String(Number(i.stock) - l.qty) } : i; }) });
    setCart({}); setCheckout(false);
    flush().then(() => {
      const r = sent().find((x) => x.receipt_no === body.receipt_no);
      if (r) setOutcome(r.sync_status === 'SYNCED' ? { kind: 'ok', text: `تم البيع — فاتورة رقم ${r.invoice_no}` }
        : { kind: 'conflict', text: `حُفظ الإيصال لكنه معلّق: ${reasonAr(r.reason)}. راجع تبويب التعارضات.` });
      else if (navigator.onLine) setOutcome({ kind: 'fail', text: 'رفض الخادم الإيصال، راجع تبويب التعارضات.' });
      else setOutcome({ kind: 'wait', text: 'حُفظ على الجهاز وسيُرسل تلقائيًا عند عودة الاتصال.' });
    });
  }

  return (
    <div className="pos">
      <form onSubmit={scan} className="search">
        <input type="search" inputMode="search" placeholder="ابحث بالاسم أو الباركود" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث عن صنف" />
      </form>
      {outcome && <div className={`banner ${outcome.kind}`} role="status" onClick={() => setOutcome(null)}>{outcome.text}<span className="x">إغلاق</span></div>}
      <ul className="items">
        {shown.map((i) => {
          const inCart = cart[i.id] ?? 0; const low = Number(i.stock) <= 0;
          return (
            <li key={i.id}>
              <button className={`item ${inCart ? 'sel' : ''}`} onClick={() => add(i)}>
                <span className="nm">{i.name_ar}</span>
                <span className="pr">{money(i.price)}</span>
                <span className={`st ${low ? 'out' : ''}`}>{low ? 'نفد' : `المتاح ${money(i.stock)}`}</span>
                {inCart > 0 && <span className="badge">{inCart}</span>}
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="muted center">لا توجد أصناف مطابقة</li>}
      </ul>
      {count > 0 && (
        <button className="cartbar" onClick={() => setCheckout(true)}>
          <span>السلة ({count})</span><strong>{money(total)} ر.ي</strong><span>الدفع ◂</span>
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
  const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const rest = Math.round((total - paid) * 100) / 100;
  const hasCredit = pays.some((p) => p.method === 'CREDIT');
  const cust = boot.customers.find((c) => c.id === customer);
  const creditAmt = pays.filter((p) => p.method === 'CREDIT').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const overLimit = !!cust && Number(cust.credit_limit) > 0 && Number(cust.balance) + creditAmt > Number(cust.credit_limit);
  const ok = lines.length > 0 && rest === 0 && pays.every((p) => Number(p.amount) > 0) && (!hasCredit || !!customer);
  const used = new Set(pays.map((p) => p.method));

  function submit() {
    onDone({
      offline_uuid: uuid(), receipt_no: receiptNo(), invoice_date: today(), shift_id: boot.shift!.id, customer_id: hasCredit ? customer : null,
      lines: lines.map((l) => ({ item_id: l.item.id, unit_id: l.item.unit_id, qty: l.qty, unit_price: Number(l.item.price) })),
      payments: pays.map((p) => ({ payment_method: p.method, amount: Number(p.amount) })),
    });
  }
  const setPay = (i: number, patch: Partial<Pay>) => setPays((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="الدفع" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h2>إتمام البيع</h2><button className="icon-btn" onClick={onClose}>رجوع</button></div>
        <ul className="clines">
          {lines.map((l) => (
            <li key={l.item.id}>
              <span className="nm">{l.item.name_ar}</span>
              <span className="qty">
                <button aria-label="إنقاص" onClick={() => add(l.item, -1)}>−</button><b>{l.qty}</b><button aria-label="زيادة" onClick={() => add(l.item, 1)}>+</button>
              </span>
              <span className="sum">{money(l.qty * Number(l.item.price))}</span>
            </li>
          ))}
        </ul>
        <div className="total"><span>الإجمالي</span><strong>{money(total)} ر.ي</strong></div>

        <h3>الدفع</h3>
        {pays.map((p, i) => (
          <div className="payrow" key={i}>
            <select value={p.method} onChange={(e) => setPay(i, { method: e.target.value })} aria-label="طريقة الدفع">
              {boot.methods.map((m) => <option key={m.method} value={m.method} disabled={used.has(m.method) && m.method !== p.method}>{m.label_ar}</option>)}
            </select>
            <input inputMode="decimal" value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value.replace(/[^\d.]/g, '') })} aria-label="المبلغ" />
            {pays.length > 1 && <button className="icon-btn" onClick={() => setPays(pays.filter((_, k) => k !== i))} aria-label="حذف">✕</button>}
          </div>
        ))}
        {pays.length < boot.methods.length && (
          <button className="btn ghost" onClick={() => setPays([...pays, { method: boot.methods.find((m) => !used.has(m.method))!.method, amount: String(Math.max(rest, 0)) }])}>+ طريقة دفع أخرى</button>
        )}
        {rest !== 0 && <p className="error">{rest > 0 ? `المتبقي ${money(rest)}` : `زيادة ${money(-rest)}`}</p>}

        {hasCredit && (
          <>
            <label>العميل (للبيع الآجل)
              <select value={customer} onChange={(e) => setCustomer(e.target.value)}>
                <option value="">اختر العميل…</option>
                {boot.customers.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </label>
            {cust && <p className={overLimit ? 'error' : 'muted'}>
              الرصيد الحالي {money(cust.balance)} · {Number(cust.credit_limit) > 0 ? `السقف ${money(cust.credit_limit)}` : 'بلا سقف'}
              {overLimit && ' — سيتجاوز السقف وسيُعلَّق الإيصال حتى موافقة المدير'}
            </p>}
          </>
        )}
        <button className="btn primary big" disabled={!ok} onClick={submit}>تأكيد البيع — {money(total)} ر.ي</button>
      </div>
    </div>
  );
}
