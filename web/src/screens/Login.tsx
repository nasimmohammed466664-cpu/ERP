import { useState } from 'react';
import { api, ApiError, setToken, type LoginResult } from '../api';
import Icon from '../components/Icon';

const msg = (x: unknown) => (x instanceof ApiError ? (x.status === 0 ? 'لا يوجد اتصال. تسجيل الدخول يحتاج إنترنت.' : x.message) : 'حدث خطأ غير متوقع.');

export default function Login({ onDone }: { onDone: () => void }) {
  const [tenant, setTenant] = useState(localStorage.getItem('erp.tenant') ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (challenge) {
        const r = await api<{ token: string }>('/auth/2fa', { body: { challenge, code: code.trim() } });
        setToken(r.token);
        localStorage.setItem('erp.tenant', tenant);
        onDone();
      } else {
        const r = await api<LoginResult>('/auth/login', { body: { tenant, username, password } });
        if (r.needs_2fa && r.challenge) { setChallenge(r.challenge); setCode(''); }
        else { localStorage.setItem('erp.tenant', tenant); setToken(r.token!); onDone(); }
      }
    } catch (x) {
      if (x instanceof ApiError && x.code === 'CHALLENGE_EXPIRED') { setChallenge(null); setPassword(''); setCode(''); }
      setErr(msg(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-decoration" aria-hidden="true"><span /><span /><span /></div>
      <div className="login-content">
        <div className="login-brand">
          <span className="brand-mark brand-mark-large"><Icon name="store" size={27} /></span>
          <div><strong>نقطة البيع</strong><span>مساحة عملك، ببساطة وأمان</span></div>
        </div>
        <form className="login-card" onSubmit={submit}>
          <div className="login-intro">
            <span className="login-kicker">مرحبًا بعودتك</span>
            <h1>{challenge ? 'تحقق من هويتك' : 'تسجيل الدخول'}</h1>
            <p className="muted">{challenge ? 'أدخل رمز المصادقة لإكمال الدخول إلى حسابك.' : 'أدخل بيانات حسابك للمتابعة إلى نقطة البيع.'}</p>
          </div>

          {challenge ? (
            <>
              <div className="security-note"><span className="note-icon"><Icon name="shieldCheck" size={20} /></span><span>افتح تطبيق المصادقة على هاتفك وأدخل الرمز المكوّن من 6 أرقام. يمكنك استخدام رمز استرداد عند الحاجة.</span></div>
              <label>رمز التحقق
                <input className="code-input" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" dir="ltr" autoFocus required aria-describedby={err ? 'login-error' : undefined} />
              </label>
            </>
          ) : (
            <>
              <label>رمز الشركة
                <input value={tenant} onChange={(e) => setTenant(e.target.value)} autoCapitalize="characters" autoComplete="organization" required autoFocus />
              </label>
              <label>اسم المستخدم
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required />
              </label>
              <label>كلمة المرور
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </label>
            </>
          )}

          {err && <p id="login-error" className="error login-error" role="alert">{err}</p>}
          <button className="btn primary login-submit" disabled={busy || (!!challenge && code.trim().length < 6)}>
            {busy ? 'جارٍ التحقق…' : challenge ? 'تأكيد الدخول' : 'دخول إلى النظام'}
            <Icon name="arrowLeft" size={18} />
          </button>
          {challenge && <button type="button" className="btn ghost login-back" onClick={() => { setChallenge(null); setErr(''); setPassword(''); setCode(''); }}>العودة إلى تسجيل الدخول</button>}

          <div className="login-footer"><Icon name="lock" size={16} /><span>اتصال آمن · بياناتك محمية</span></div>
        </form>
        <p className="login-caption">نظام نقاط البيع وإدارة الورديات</p>
      </div>
    </div>
  );
}
