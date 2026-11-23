import { useState } from 'react';
import { api, ApiError } from '../api';
import { today } from '../format';
import Icon from '../components/Icon';

export default function OpenShift({ onOpened, offline }: { onOpened: () => void; offline: boolean }) {
  const [float, setFloat] = useState('0');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function open(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/shifts/open', { body: { opening_float: Number(float) || 0, date: today() } });
      onOpened();
    } catch (x) {
      setErr(x instanceof ApiError ? (x.code === 'SHIFT_ALREADY_OPEN' ? 'توجد وردية مفتوحة على صندوق الكاشير، ربما لدى مستخدم آخر.' : x.message) : 'حدث خطأ غير متوقع.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card pad shift-entry" onSubmit={open}>
      <div className="entry-icon"><Icon name="wallet" size={25} /></div>
      <div className="entry-copy">
        <span className="eyebrow">خطوة سريعة</span>
        <h2>افتح وردية جديدة</h2>
        <p className="muted">أدخل مبلغ النقد الموجود في الدرج الآن. يساعدك ذلك على مطابقة الصندوق عند الإغلاق.</p>
      </div>
      <label className="money-label">العهدة الافتتاحية <span className="field-hint">يمكنك إدخال 0 إذا لم توجد عهدة</span>
        <span className="money-field"><input className="numeric-input" type="text" inputMode="decimal" value={float} onChange={(e) => setFloat(e.target.value.replace(/[^\d.]/g, ''))} aria-label="مبلغ العهدة الافتتاحية" /><span className="currency">ر.ي</span></span>
      </label>
      {offline && <p className="inline-notice notice-warn"><Icon name="wifiOff" size={18} /> فتح الوردية يحتاج اتصالًا بالخادم.</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="entry-tip"><Icon name="shieldCheck" size={17} /><span>لن تبدأ المبيعات قبل تأكيد فتح الوردية.</span></div>
      <button className="btn primary entry-submit" disabled={busy || offline}>
        {busy ? 'جارٍ فتح الوردية…' : 'فتح الوردية والبدء بالبيع'}
        {!busy && <Icon name="arrowLeft" size={18} />}
      </button>
    </form>
  );
}
