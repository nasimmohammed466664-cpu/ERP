import type { ReactNode } from 'react';

export type IconName =
  | 'store' | 'search' | 'cart' | 'receipt' | 'clock' | 'alert' | 'user' | 'logout'
  | 'wifi' | 'wifiOff' | 'chevronLeft' | 'plus' | 'minus' | 'close' | 'package'
  | 'check' | 'shield' | 'shieldCheck' | 'key' | 'refresh' | 'calendar' | 'arrowLeft'
  | 'wallet' | 'scan' | 'inbox' | 'settings' | 'lock' | 'spark' | 'barcode' | 'trash'
  | 'rotate' | 'circleCheck' | 'arrowUpRight' | 'chart' | 'copy';

const shapes: Record<IconName, ReactNode> = {
  store: <><path d="M3 10.5 4.4 5h15.2l1.4 5.5" /><path d="M4.5 10v9.5h15V10" /><path d="M9 19.5v-6h6v6" /><path d="M3.4 10.5a2.1 2.1 0 0 0 4.2 0 2.1 2.1 0 0 0 4.2 0 2.1 2.1 0 0 0 4.2 0 2.1 2.1 0 0 0 4.2 0" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  cart: <><path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.5L21 8H6" /><circle cx="9.5" cy="20" r="1" /><circle cx="17.5" cy="20" r="1" /></>,
  receipt: <><path d="M6 3.5h12v17l-2.5-1.8-3.5 1.8-3.5-1.8L6 20.5z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  alert: <><path d="M10.3 4.7 2.9 17.5a1.7 1.7 0 0 0 1.5 2.5h15.2a1.7 1.7 0 0 0 1.5-2.5L13.7 4.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 16.5h.01" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.7-3.4 3.3-5.2 7.5-5.2s6.8 1.8 7.5 5.2" /></>,
  logout: <><path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" /><path d="M14 8l4 4-4 4M8 12h10" /></>,
  wifi: <><path d="M5 9.5a11 11 0 0 1 14 0M8 12.5a6.5 6.5 0 0 1 8 0M11 15.5a2 2 0 0 1 2 0" /><circle cx="12" cy="19" r=".7" /></>,
  wifiOff: <><path d="M5 9.5a11 11 0 0 1 14 0M8 12.5a6.5 6.5 0 0 1 5.4-1.5M11 15.5a2 2 0 0 1 2 0M3 3l18 18" /></>,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  package: <><path d="m12 3 8 4.3v9.4L12 21l-8-4.3V7.3L12 3Z" /><path d="m4.3 7.5 7.7 4.2 7.7-4.2M12 12v8.5M8 5.1l8 4.4" /></>,
  check: <path d="m5 12.5 4.3 4.2L19 7" />,
  shield: <><path d="M12 3 19 6v5.2c0 4.4-2.8 7.7-7 9.8-4.2-2.1-7-5.4-7-9.8V6l7-3Z" /></>,
  shieldCheck: <><path d="M12 3 19 6v5.2c0 4.4-2.8 7.7-7 9.8-4.2-2.1-7-5.4-7-9.8V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8 2 2-2 2 1.5 1.5-2 2L17 10l-3 3" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.8-2L20 12M4 12l2.6 5a7 7 0 0 0 11.8-2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" /></>,
  arrowLeft: <><path d="M19 12H5M12 19l-7-7 7-7" /></>,
  wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6a3 3 0 0 1-3-3V6.5Z" /><path d="M3 8h17M16 13h4" /><circle cx="16" cy="13" r=".6" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M7 12h10M9 9v6M12 9v6M15 9v6" /></>,
  inbox: <><path d="M4 4h16l1 11v4H3v-4L4 4Z" /><path d="M3.5 14h5l1.5 2h4l1.5-2h5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.2 1-.1.2-1.6 2.8-.2-.1-1.5-.5a7.7 7.7 0 0 1-1.5.9l-.3 1.6h-3.2l-.3-1.6a7.7 7.7 0 0 1-1.5-.9l-1.5.5-.2.1-1.6-2.8-.1-.2 1.2-1a7.8 7.8 0 0 1 0-1.8l-1.2-1 .1-.2 1.6-2.8.2.1 1.5.5a7.7 7.7 0 0 1 1.5-.9l.3-1.6h3.2l.3 1.6a7.7 7.7 0 0 1 1.5.9l1.5-.5.2-.1 1.6 2.8.1.2-1.2 1a7.8 7.8 0 0 1 0 1.8Z" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
  barcode: <><path d="M4 5v14M7 5v14M10 5v14M14 5v14M16 5v14M20 5v14" /><path d="M3 3h18M3 21h18" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
  rotate: <><path d="M20 11a8 8 0 0 0-14.8-4L3 10M3 5v5h5M4 13a8 8 0 0 0 14.8 4L21 14m0 5v-5h-5" /></>,
  circleCheck: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>,
  arrowUpRight: <><path d="M7 17 17 7M8 7h9v9" /></>,
  chart: <><path d="M4 19.5h16" /><path d="M7 16V9M12 16V5M17 16v-4" /><path d="m5 7 5-3 4 2 5-3" /></>,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" /></>,
};

export default function Icon({ name, size = 20, strokeWidth = 1.8, className }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[name]}
    </svg>
  );
}
