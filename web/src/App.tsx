import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, getToken, setToken, type Bootstrap } from './api';
import { clearAll, clearBoot, flush, queue, failed, init, loadBoot, saveBoot } from './offline';
import Login from './screens/Login';
import OpenShift from './screens/OpenShift';
import Pos from './screens/Pos';
import Shift from './screens/Shift';
import Conflicts from './screens/Conflicts';
import Invoices from './screens/Invoices';
import Account from './screens/Account';

type Tab = 'pos' | 'invoices' | 'shift' | 'conflicts' | 'account';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [ready, setReady] = useState(false);
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [pending, setPending] = useState(0);
  const [problems, setProblems] = useState(0);
  const [tab, setTab] = useState<Tab>('pos');
  const [loadError, setLoadError] = useState('');
  const [forced2fa, setForced2fa] = useState(false);

  const load = useCallback(async () => {
    try {
      const b = await api<Bootstrap>('/pos/bootstrap');
      await saveBoot(b); setBoot(b); setOffline(false); setLoadError(''); setForced2fa(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) setOffline(true);            // keep working from the cached copy
      else if (e instanceof ApiError && e.code === 'TWO_FA_ENROLLMENT_REQUIRED') setForced2fa(true);
      else if (!(e instanceof ApiError && e.status === 401)) setLoadError(e instanceof Error ? e.message : 'خطأ');
    }
  }, []);

  useEffect(() => {
    const sync = () => { setPending(queue().length); setProblems(failed().length); };
    const on = () => { setOffline(false); flush().then(load); };
    const off = () => setOffline(true);
    const out = () => { setAuthed(false); };
    window.addEventListener('erp:queue', sync); window.addEventListener('online', on); window.addEventListener('offline', off); window.addEventListener('erp:logout', out);
    const t = setInterval(() => { if (queue().length) flush(); }, 15000);
    return () => { window.removeEventListener('erp:queue', sync); window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('erp:logout', out); clearInterval(t); };
  }, [load]);

  // open the local database first: the cached catalogue and any unsent sales must be there before anything is shown
  useEffect(() => { init().then(loadBoot).then((b) => { if (b) setBoot(b); setReady(true); }); }, []);
  useEffect(() => { if (authed && ready) { flush().then(load); } }, [authed, ready, load]);

  async function logout() {
    if (queue().length && !confirm('يوجد إيصالات لم تُرسل بعد وستبقى على هذا الجهاز. تسجيل الخروج؟')) return;
    setToken(null); if (queue().length) await clearBoot(); else await clearAll(); setBoot(null); setAuthed(false);
  }

  if (!ready) return <div className="center muted">جارٍ التحميل…</div>;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  if (forced2fa) return <div className="app"><header className="top"><strong>إعداد الحساب</strong></header><main><Account forced onChanged={() => { setForced2fa(false); load(); }} onLogout={logout} /></main></div>;
  if (!boot) return <div className="center muted">{loadError || 'جارٍ التحميل…'}{loadError && <button className="btn" onClick={load}>إعادة المحاولة</button>}</div>;

  return (
    <div className="app">
      <header className="top">
        <div><strong>{boot.branch.name_ar}</strong><span className="muted"> · {boot.user.name}</span></div>
        <div className="top-end">
          {offline && <span className="chip warn">بلا اتصال</span>}
          {pending > 0 && <span className="chip info">{pending} بانتظار الإرسال</span>}
          <button className="icon-btn" onClick={() => setTab('account')}>حسابي</button>
          <button className="icon-btn" onClick={logout} aria-label="تسجيل الخروج">خروج</button>
        </div>
      </header>
      <main>
        {tab === 'pos' && (boot.shift ? <Pos boot={boot} setBoot={setBoot} /> : <OpenShift onOpened={load} offline={offline} />)}
        {tab === 'invoices' && <Invoices boot={boot} offline={offline} />}
        {tab === 'shift' && <Shift boot={boot} reload={load} />}
        {tab === 'conflicts' && <Conflicts boot={boot} reload={load} />}
        {tab === 'account' && <Account forced={false} onChanged={load} onLogout={() => { setToken(null); clearAll().then(() => { setBoot(null); setAuthed(false); }); }} />}
      </main>
      <nav className="tabs">
        <button className={tab === 'pos' ? 'on' : ''} onClick={() => setTab('pos')}>البيع</button>
        <button className={tab === 'invoices' ? 'on' : ''} onClick={() => setTab('invoices')}>الفواتير</button>
        <button className={tab === 'shift' ? 'on' : ''} onClick={() => setTab('shift')}>الوردية</button>
        <button className={tab === 'conflicts' ? 'on' : ''} onClick={() => setTab('conflicts')}>التعارضات{problems > 0 && <span className="dot">{problems}</span>}</button>
      </nav>
    </div>
  );
}
