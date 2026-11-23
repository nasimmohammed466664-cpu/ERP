import { useEffect, useState } from 'react';
import { api, ApiError, setToken, type Me } from '../api';
import Icon from '../components/Icon';

const msg = (x: unknown) => (x instanceof ApiError ? (x.status === 0 ? 'لا يوجد اتصال بالخادم' : x.message) : 'حدث خطأ غير متوقع.');

export default function Account({ forced, onChanged, onLogout }: { forced: boolean; onChanged: () => void; onLogout: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; qr_svg: string } | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [off, setOff] = useState({ password: '', code: '' });

  const refresh = () => api<Me>('/me').then(setMe).catch((x) => setErr(msg(x)));
  useEffect(() => { void refresh(); }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr('');
    setOk('');
    try { await fn(); }
    catch (x) { setErr(msg(x)); }
    finally { setBusy(false); }
  }
  const startSetup = () => run(async () => setSetup(await api('/auth/2fa/setup', { method: 'POST', body: {} })));
  const enable = () => run(async () => {
    const r = await api<{ token: string; recovery_codes: string[] }>('/auth/2fa/enable', { body: { code: code.trim() } });
    setToken(r.token);
    setRecovery(r.recovery_codes);
    setSetup(null);
    setCode('');
    await refresh();
  });
  const disable = () => run(async () => {
    const r = await api<{ token: string }>('/auth/2fa/disable', { body: { password: off.password, code: off.code.trim() } });
    setToken(r.token);
    setOff({ password: '', code: '' });
    setOk('أُوقفت المصادقة الثنائية.');
    await refresh();
  });
  const changePassword = () => run(async () => {
    const r = await api<{ token: string }>('/auth/password', { body: pw });
    setToken(r.token);
    setPw({ current: '', next: '' });
    setOk('تم تغيير كلمة المرور، وانتهت الجلسات الأخرى.');
  });
  const logoutAll = () => run(async () => {
    if (!confirm('سيُسجَّل خروجك من كل الأجهزة، بما فيها هذا الجهاز. متابعة؟')) return;
    await api('/auth/logout-all', { method: 'POST', body: {} });
    onLogout();
  });

  // Recovery codes are shown exactly once; keep the confirmation as the only action until they are saved.
  if (recovery) return (
    <div className="stack account-screen">
      <section className="card pad recovery-card">
        <span className="recovery-icon"><Icon name="key" size={24} /></span>
        <span className="eyebrow">خطوة أخيرة</span>
        <h2>احفظ رموز الاسترداد</h2>
        <p className="warnbox">احفظ هذه الرموز الآن في مكان آمن. يعمل كل رمز مرة واحدة عند فقدان هاتفك، ولن تظهر هذه الرموز مرة أخرى.</p>
        <ul className="codes" dir="ltr">{recovery.map((c) => <li key={c}>{c}</li>)}</ul>
        <button type="button" className="btn" onClick={() => { void navigator.clipboard?.writeText(recovery.join('\n')); }}><Icon name="copy" size={17} /> نسخ الرموز</button>
        <button type="button" className="btn primary big" onClick={() => { setRecovery(null); onChanged(); }}><Icon name="check" size={18} /> حفظتُها، متابعة</button>
      </section>
    </div>
  );

  return (
    <div className="stack account-screen">
      {forced && <p className="inline-notice notice-warn"><Icon name="shield" size={19} /> سياسة المنشأة تُلزم حسابك بتفعيل المصادقة الثنائية قبل استخدام النظام.</p>}
      {err && <p className="inline-notice notice-warn" role="alert"><Icon name="alert" size={18} />{err}</p>}
      {ok && <p className="inline-notice notice-success" role="status"><Icon name="circleCheck" size={18} />{ok}</p>}

      {me && <div className="account-profile">
        <span className="avatar profile-avatar">{me.name.trim().slice(0, 1)}</span>
        <span className="profile-copy"><small>الحساب الحالي</small><strong>{me.name}</strong><span>إعدادات الأمان والجلسة</span></span>
        <span className={`chip ${me.two_fa_enabled ? 'success-chip' : 'warn'}`}>{me.two_fa_enabled ? 'الحماية مفعّلة' : 'الحماية الأساسية'}</span>
      </div>}

      {me && (
        <section className="card pad setting-card">
          <div className="section-title-row"><span className="action-icon"><Icon name="shieldCheck" size={20} /></span><div><h2>المصادقة الثنائية</h2><p className="muted">طبقة حماية إضافية عند تسجيل الدخول.</p></div><span className={`chip ${me.two_fa_enabled ? 'success-chip' : 'warn'}`}>{me.two_fa_enabled ? 'مفعّلة' : 'غير مفعّلة'}</span></div>
          {!me.two_fa_enabled && !setup && <>
            <p className="setting-description">تضيف رمزًا يتغير كل 30 ثانية من تطبيق على هاتفك، فلا تكفي كلمة المرور وحدها لدخول الحساب.</p>
            <button type="button" className="btn primary" onClick={startSetup} disabled={busy}><Icon name="shieldCheck" size={18} />{busy ? 'جارٍ إعداد المصادقة…' : 'تفعيل المصادقة الثنائية'}</button>
          </>}
          {setup && <div className="twofa-setup">
            <p className="setup-step"><span>١</span> افتح تطبيق المصادقة وامسح رمز QR.</p>
            <div className="qr" dangerouslySetInnerHTML={{ __html: setup.qr_svg }} />
            <p className="muted small">أو أدخل هذا المفتاح يدويًا:</p>
            <code className="secret" dir="ltr">{setup.secret}</code>
            <label>٢. أدخل الرمز الظاهر في التطبيق<input className="code-input" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" dir="ltr" /></label>
            <button type="button" className="btn primary" onClick={enable} disabled={busy || code.trim().length !== 6}>{busy ? 'جارٍ التحقق…' : 'تأكيد وتفعيل'}</button>
          </div>}
          {me.two_fa_enabled && !me.two_fa_required && <div className="twofa-disable">
            <p className="setting-description">لإيقافها أدخل كلمة المرور ورمزًا حاليًا من تطبيق المصادقة.</p>
            <label>كلمة المرور<input type="password" value={off.password} onChange={(e) => setOff({ ...off, password: e.target.value })} autoComplete="current-password" /></label>
            <label>رمز التحقق<input className="code-input" value={off.code} onChange={(e) => setOff({ ...off, code: e.target.value })} inputMode="numeric" dir="ltr" autoComplete="one-time-code" /></label>
            <button type="button" className="btn danger" onClick={disable} disabled={busy || !off.password || off.code.trim().length < 6}>إيقاف المصادقة الثنائية</button>
          </div>}
          {me.two_fa_enabled && me.two_fa_required && <p className="inline-notice notice-info"><Icon name="lock" size={17} /> إيقاف المصادقة غير متاح بسبب سياسة المنشأة.</p>}
        </section>
      )}

      {!forced && <>
        <section className="card pad setting-card">
          <div className="section-title-row"><span className="action-icon"><Icon name="key" size={20} /></span><div><h2>تغيير كلمة المرور</h2><p className="muted">استخدم كلمة مرور قوية لا تقل عن 10 أحرف.</p></div></div>
          <label>كلمة المرور الحالية<input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></label>
          <label>كلمة المرور الجديدة <span className="field-hint">10 أحرف على الأقل، وتحتوي حروفًا وأرقامًا</span><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></label>
          <button type="button" className="btn primary" onClick={changePassword} disabled={busy || !pw.current || !pw.next}>{busy ? 'جارٍ التغيير…' : 'حفظ كلمة المرور'}<Icon name="arrowLeft" size={17} /></button>
        </section>
        <section className="card pad setting-card">
          <div className="section-title-row"><span className="action-icon danger-icon"><Icon name="user" size={20} /></span><div><h2>الجلسات والأجهزة</h2><p className="muted">أنه الجلسات الأخرى إذا فقدت هاتفًا أو شككت في استخدام الحساب.</p></div></div>
          <button type="button" className="btn danger" onClick={logoutAll} disabled={busy}><Icon name="logout" size={18} /> تسجيل الخروج من كل الأجهزة</button>
        </section>
      </>}
      {forced && <button type="button" className="btn ghost" onClick={onLogout}><Icon name="logout" size={17} /> تسجيل الخروج</button>}
    </div>
  );
}
