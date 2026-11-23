import { useState } from 'react';
import { api, ApiError } from '../api';
import { today } from '../format';

export default function OpenShift({ onOpened, offline }: { onOpened: () => void; offline: boolean }) {
  const [float, setFloat] = useState('0'); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function open(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/shifts/open', { body: { opening_float: Number(float) || 0, date: today() } }); onOpened(); }
    catch (x) { setErr(x instanceof ApiError ? (x.code === 'SHIFT_ALREADY_OPEN' ? 'توجد وردية مفتوحة على صندوق الكاشير (ربما عند مستخدم آخر).' : x.message) : 'خطأ'); }
    finally { setBusy(false); }
  }
  return (
    <form className="card pad" onSubmit={open}>
      <h2>فتح وردية</h2>
      <p className="muted">أدخل العهدة النقدية الموجودة في الدرج الآن.</p>
      <label>العهدة الافتتاحية<input inputMode="decimal" value={float} onChange={(e) => setFloat(e.target.value.replace(/[^\d.]/g, ''))} /></label>
      {offline && <p className="error">فتح الوردية يحتاج اتصالًا بالخادم.</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary" disabled={busy || offline}>{busy ? 'جارٍ الفتح…' : 'فتح الوردية'}</button>
    </form>
  );
}
