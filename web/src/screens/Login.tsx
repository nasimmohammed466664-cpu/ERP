import { useState } from 'react';
import { api, ApiError, setToken, type LoginResult } from '../api';

const msg = (x: unknown) => (x instanceof ApiError ? (x.status === 0 ? 'لا يوجد اتصال. تسجيل الدخول يحتاج إنترنت.' : x.message) : 'خطأ');

export default function Login({ onDone }: { onDone: () => void }) {
  const [tenant, setTenant] = useState(localStorage.getItem('erp.tenant') ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      if (challenge) {
        const r = await api<{ token: string }>('/auth/2fa', { body: { challenge, code: code.trim() } });
        setToken(r.token); localStorage.setItem('erp.tenant', tenant); onDone();
      } else {
        const r = await api<LoginResult>('/auth/login', { body: { tenant, username, password } });
        if (r.needs_2fa && r.challenge) { setChallenge(r.challenge); setCode(''); }
        else { localStorage.setItem('erp.tenant', tenant); setToken(r.token!); onDone(); }
      }
    } catch (x) {
      if (x instanceof ApiError && x.code === 'CHALLENGE_EXPIRED') { setChallenge(null); setPassword(''); setCode(''); }
      setErr(msg(x));
    } finally { setBusy(false); }
  }

  if (challenge) return (
    <form className="login" onSubmit={submit}>
      <h1>التحقق بخطوتين</h1>
      <p className="muted">افتح تطبيق المصادقة على هاتفك وأدخل الرمز المكوّن من 6 أرقام. إن فقدت هاتفك استخدم أحد رموز الاسترداد.</p>
      <label>رمز التحقق<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" dir="ltr" autoFocus required /></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary" disabled={busy || code.trim().length < 6}>{busy ? 'جارٍ التحقق…' : 'تأكيد'}</button>
      <button type="button" className="btn ghost" onClick={() => { setChallenge(null); setErr(''); setPassword(''); }}>رجوع</button>
    </form>
  );
  return (
    <form className="login" onSubmit={submit}>
      <h1>نقطة البيع</h1>
      <label>رمز الشركة<input value={tenant} onChange={(e) => setTenant(e.target.value)} autoCapitalize="characters" autoComplete="organization" required /></label>
      <label>اسم المستخدم<input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required /></label>
      <label>كلمة المرور<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary" disabled={busy}>{busy ? 'جارٍ الدخول…' : 'دخول'}</button>
    </form>
  );
}
