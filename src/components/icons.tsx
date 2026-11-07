const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }

export const IHome = () => <svg {...s}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>
export const IPipeline = () => <svg {...s}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></svg>
export const IClients = () => <svg {...s}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 010 7" /><path d="M18.5 14.8c1.6.8 2.6 2.5 3 5.2" /></svg>
export const IProjets = () => <svg {...s}><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M8 5V3.5h8V5" /><path d="M3 11h18" /></svg>
export const IFinance = () => <svg {...s}><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 10h19" /><path d="M6.5 15h4" /></svg>
export const ICatalogue = () => <svg {...s}><path d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5z" /><path d="M13 4h5.5A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5H13z" /></svg>
export const IPlus = () => <svg {...s}><path d="M12 5v14M5 12h14" /></svg>
export const IMenu = () => <svg {...s}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
export const IExt = () => <svg {...s}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></svg>
export const IMoon = () => <svg {...s}><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" /></svg>
export const ISun = () => <svg {...s}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></svg>
