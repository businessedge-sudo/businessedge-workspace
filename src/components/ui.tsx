import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Ton } from '../lib/referentiel'

export function Pill({ ton = 'mute', children }: { ton?: Ton; children: ReactNode }) {
  return <span className={`pill ${ton}`}>{children}</span>
}

export function Spinner() { return <span className="spinner" aria-label="Chargement" /> }

export function Loading() { return <div className="center"><Spinner /></div> }

export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div> }

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'gold' | 'green' | 'red' }) {
  return (
    <div className="card card-pad kpi">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`}>{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

export function Bar({ pct }: { pct: number }) {
  const v = Math.max(0, Math.min(100, Math.round(pct || 0)))
  return <div className={`bar ${v >= 100 ? 'done' : ''}`} title={`${v} %`}><i style={{ width: `${v}%` }} /></div>
}

export function Panel({ title, subtitle, onClose, children, footer }: {
  title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="panel" role="dialog" aria-modal="true">
        <div className="panel-head">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="panel-body">{children}</div>
        {footer && <div className="panel-foot">{footer}</div>}
      </aside>
    </>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

/** Liste déroulante : valeur vide autorisée, libellés optionnels. */
export function Select({ value, options, labels, onChange, allowEmpty = true }: {
  value: string | null | undefined; options: readonly string[]; labels?: Record<string, string>
  onChange: (v: string | null) => void; allowEmpty?: boolean
}) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowEmpty && <option value="">—</option>}
      {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
    </select>
  )
}

/* ---------- Notifications ---------- */
type ToastMsg = { text: string; err?: boolean } | null
const ToastCtx = createContext<(text: string, err?: boolean) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg>(null)
  const show = useCallback((text: string, err = false) => {
    setMsg({ text, err })
    window.setTimeout(() => setMsg(null), err ? 6000 : 2600)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className={`toast ${msg.err ? 'err' : ''}`} role="status">{msg.text}</div>}
    </ToastCtx.Provider>
  )
}

/* ---------- Données ---------- */
/** Charge des données et expose un rechargement. Les erreurs remontent en notification. */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const toast = useToast()
  const [data, setData] = useState<T | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let vivant = true
    load().then((d) => { if (vivant) setData(d) }).catch((e: Error) => toast(e.message, true))
    return () => { vivant = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, reload: () => setTick((t) => t + 1) }
}
