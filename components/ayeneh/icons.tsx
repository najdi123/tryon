// Line icons, drawn to match the reference screens. All decorative: aria-hidden.
type P = { size?: number; className?: string };

function Svg({ size = 22, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

export const IconHelp = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9.5" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.5-1.2 1-1.2 1.9" /><path d="M12 16.9h.01" /></Svg>;
export const IconArrowLeft = (p: P) => <Svg {...p}><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></Svg>;
export const IconArrowRight = (p: P) => <Svg {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="m14.5 6-6 6 6 6" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const IconCamera = (p: P) => <Svg {...p}><path d="M4 8.5h3l1.6-2.3h6.8L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.4" /></Svg>;
export const IconImage = (p: P) => <Svg {...p}><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="8.5" cy="10" r="1.6" /><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" /></Svg>;
export const IconFrame = (p: P) => <Svg {...p}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><circle cx="12" cy="12" r="3" /></Svg>;
export const IconLock = (p: P) => <Svg {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><path d="M12 14.5v2" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></Svg>;
export const IconInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9.5" /><path d="M12 11v6" /><path d="M12 7.5h.01" /></Svg>;
export const IconDownload = (p: P) => <Svg {...p}><path d="M12 4v11" /><path d="m7.5 11 4.5 4.5 4.5-4.5" /><path d="M5 19.5h14" /></Svg>;
export const IconShare = (p: P) => <Svg {...p}><circle cx="6.5" cy="12" r="2.3" /><circle cx="17" cy="6" r="2.3" /><circle cx="17" cy="18" r="2.3" /><path d="m8.6 10.9 6.3-3.7M8.6 13.1l6.3 3.7" /></Svg>;
export const IconHair = (p: P) => <Svg {...p}><path d="M6 20c-1.5-3-2-6-1.5-9A7.5 7.5 0 0 1 19.5 11c.5 3 0 6-1.5 9" /><path d="M9 20c-.8-2-.8-4.5 0-6.5 2.5 0 4.5-1 6-3 1 2.5 1 6.5 0 9.5" /></Svg>;

export function Mirror({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.18} viewBox="0 0 34 40" fill="none" aria-hidden>
      <ellipse cx="17" cy="15" rx="12" ry="14" fill="var(--teal-soft)" stroke="var(--ink)" strokeWidth="1.8" />
      <path d="m10 20 12-13M15 23l8-9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M17 29v6M10 37.5h14" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
