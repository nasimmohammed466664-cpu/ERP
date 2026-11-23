import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, getToken, setToken, type Bootstrap } from './api';
import { clearAll, clearBoot, flush, queue, failed, init, loadBoot, saveBoot } from './offline';
import Icon, { type IconName } from './components/Icon';
import Login from './screens/Login';
import OpenShift from './screens/OpenShift';
import Pos from './screens/Pos';
import Shift from './screens/Shift';
import Conflicts from './screens/Conflicts';
import Invoices from './screens/Invoices';
import Account from './screens/Account';

type Tab = 'pos' | 'invoices' | 'shift' | 'conflicts' | 'account';

const navItems: { id: Exclude<Tab, 'account'>; label: string; icon: IconName }[] = [
  { id: 'pos', label: 'البيع', icon: 'cart' },
  { id: 'invoices', label: 'الفواتير', icon: 'receipt' },
  { id: 'shift', label: 'الوردية', icon: 'clock' },
  { id: 'conflicts', label: 'المزامنة', icon: 'refresh' },
];

const pageCopy: Record<Tab, { eyebrow: string; title: string; description: string; icon: IconName }> = {
  pos: { eyebrow: 'نقطة البيع', title: 'بيع جديد', description: 'ابحث عن صنف أو امسح الباركود، ثم أضفه إلى السلة.', icon: 'cart' },
  invoices: { eyebrow: 'المبيعات', title: 'الفواتير', description: 'ابحث في الفواتير السابقة وراجع تفاصيلها أو سجّل مرتجعًا.', icon: 'receipt' },
  shift: { eyebrow: 'إدارة النقدية', title: 'الوردية', description: 'تابع حركة الصندوق، راجع الإيصالات، وأغلق الوردية بعد العدّ.', icon: 'clock' },
  conflicts: { eyebrow: 'حالة المزامنة', title: 'الإيصالات المعلّقة', description: 'راجع الإيصالات التي تحتاج إلى إجراء قبل ترحيلها.', icon: 'refresh' },
  account: { eyebrow: 'الأمان والتفضيلات', title: 'إعدادات الحساب', description: 'أدر كلمة المرور والمصادقة الثنائية والجلسات النشطة.', icon: 'user' },
};

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
      await saveBoot(b);
      setBoot(b);
      setOffline(false);
      setLoadError('');
      setForced2fa(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setOffline(true); // Keep working from the cached copy when available.
        setLoadError('لا يوجد اتصال بالخادم. أعد المحاولة عند عودة الاتصال.');
      } else if (e instanceof ApiError && e.code === 'TWO_FA_ENROLLMENT_REQUIRED') {
        setForced2fa(true);
      } else if (!(e instanceof ApiError && e.status === 401)) {
        setLoadError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع.');
      }
    }
  }, []);

  useEffect(() => {
    const sync = () => { setPending(queue().length); setProblems(failed().length); };
    const on = () => { setOffline(false); void flush().then(load); };
    const off = () => setOffline(true);
    const out = () => { setAuthed(false); };
    window.addEventListener('erp:queue', sync);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('erp:logout', out);
    const t = setInterval(() => { if (queue().length) void flush(); }, 15000);
    return () => {
      window.removeEventListener('erp:queue', sync);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('erp:logout', out);
      clearInterval(t);
    };
  }, [load]);

  // Open the local database first so cached items and unsent sales are ready before the UI appears.
  useEffect(() => {
    init().then(loadBoot).then((b) => {
      if (b) setBoot(b);
      setReady(true);
    });
  }, []);
  useEffect(() => { if (authed && ready) { void flush().then(load); } }, [authed, ready, load]);

  async function logout() {
    if (queue().length && !confirm('يوجد إيصالات لم تُرسل بعد وستبقى على هذا الجهاز. تسجيل الخروج؟')) return;
    setToken(null);
    if (queue().length) await clearBoot(); else await clearAll();
    setBoot(null);
    setAuthed(false);
  }

  if (!ready) return <div className="state-screen"><div className="state-mark"><Icon name="store" size={26} /></div><p>جارٍ تجهيز نقطة البيع…</p></div>;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  if (forced2fa) return (
    <div className="app">
      <header className="top top-compact">
        <div className="brand-lockup">
          <span className="brand-mark"><Icon name="store" size={23} /></span>
          <span className="brand-copy"><strong>نقطة البيع</strong><small>إعداد الحساب</small></span>
        </div>
        <button className="icon-btn logout-btn" onClick={logout}><Icon name="logout" size={17} /><span>تسجيل الخروج</span></button>
      </header>
      <main className="main-content">
        <PageHeading tab="account" />
        <Account forced onChanged={() => { setForced2fa(false); void load(); }} onLogout={logout} />
      </main>
    </div>
  );

  if (!boot) return (
    <div className="state-screen">
      <div className="state-card">
        <span className="state-mark"><Icon name={offline ? 'wifiOff' : 'alert'} size={27} /></span>
        <h1>{offline ? 'لا يوجد اتصال' : 'تعذّر تحميل النظام'}</h1>
        <p className="muted">{loadError || 'جارٍ الاتصال بالخادم…'}</p>
        <button className="btn primary" onClick={() => { setLoadError(''); void load(); }}>إعادة المحاولة <Icon name="refresh" size={18} /></button>
      </div>
    </div>
  );

  return (
    <div className="app">
      <header className="top">
        <div className="brand-lockup">
          <span className="brand-mark"><Icon name="store" size={23} /></span>
          <span className="brand-copy"><strong>نقطة البيع</strong><small>{boot.branch.name_ar} <span aria-hidden="true">·</span> {boot.warehouse.name_ar}</small></span>
        </div>
        <div className="top-end">
          <button className={`account-button ${tab === 'account' ? 'active' : ''}`} onClick={() => setTab('account')} aria-label={`إعدادات حساب ${boot.user.name}`}>
            <span className="avatar" aria-hidden="true">{boot.user.name.trim().slice(0, 1)}</span>
            <span className="account-copy"><strong>{boot.user.name}</strong><small>حسابي</small></span>
          </button>
          <button className="icon-btn logout-btn" onClick={logout} aria-label="تسجيل الخروج"><Icon name="logout" size={17} /><span>خروج</span></button>
        </div>
        <div className="top-status" aria-live="polite">
          <span className={`connection-pill ${offline ? 'is-offline' : 'is-online'}`}>
            <span className="connection-dot" />
            <Icon name={offline ? 'wifiOff' : 'wifi'} size={16} />
            {offline ? 'تعمل دون اتصال' : 'متصل بالخادم'}
          </span>
          {pending > 0 && <span className="queue-pill"><Icon name="refresh" size={15} />{pending} بانتظار الإرسال</span>}
          {problems > 0 && <span className="problem-pill"><Icon name="alert" size={15} />{problems} إيصالات تحتاج مراجعة</span>}
        </div>
      </header>

      <main className="main-content">
        <PageHeading tab={tab} hasShift={!!boot.shift} />
        {tab === 'pos' && (boot.shift ? <Pos boot={boot} setBoot={setBoot} /> : <OpenShift onOpened={load} offline={offline} />)}
        {tab === 'invoices' && <Invoices boot={boot} offline={offline} />}
        {tab === 'shift' && <Shift boot={boot} reload={load} />}
        {tab === 'conflicts' && <Conflicts boot={boot} reload={load} />}
        {tab === 'account' && <Account forced={false} onChanged={load} onLogout={() => { setToken(null); void clearAll().then(() => { setBoot(null); setAuthed(false); }); }} />}
      </main>

      <nav className="tabs" aria-label="التنقل الرئيسي">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab-button ${tab === item.id ? 'on' : ''}`}
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
          >
            <span className="tab-icon"><Icon name={item.icon} size={20} /></span>
            <span>{item.label}</span>
            {item.id === 'conflicts' && problems > 0 && <span className="tab-badge">{problems}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function PageHeading({ tab, hasShift = false }: { tab: Tab; hasShift?: boolean }) {
  const meta = pageCopy[tab];
  const title = tab === 'pos' && !hasShift ? 'ابدأ ورديتك' : meta.title;
  const description = tab === 'pos' && !hasShift
    ? 'سجّل العهدة الافتتاحية لتبدأ البيع وتتابع حركة الصندوق.'
    : meta.description;
  return (
    <div className="page-head">
      <div className="page-head-copy">
        <p className="eyebrow"><span className="eyebrow-icon"><Icon name={meta.icon} size={15} /></span>{meta.eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {tab === 'pos' && hasShift && <span className="shift-live"><span className="live-dot" /> وردية نشطة</span>}
    </div>
  );
}
