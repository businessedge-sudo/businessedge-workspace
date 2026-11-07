import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db } from './lib/supabase'
import { useRoute } from './lib/route'
import { Loading } from './components/ui'
import { ICatalogue, IClients, IFinance, IHome, IMenu, IMoon, IPipeline, IProjets, ISun } from './components/icons'
import { useTheme } from './lib/theme'
import { Login } from './pages/Login'
import { Accueil } from './pages/Accueil'
import { Pipeline } from './pages/Pipeline'
import { Clients } from './pages/Clients'
import { Projets } from './pages/Projets'
import { Finance } from './pages/Finance'
import { Catalogue } from './pages/Catalogue'
import { Audit } from './pages/Audit'

type Acces = { email: string; nom: string | null; role: string }

const NAV = [
  { path: '/', label: 'Accueil', icon: <IHome /> },
  { path: '/pipeline', label: 'Pipeline', icon: <IPipeline />, badge: 'leads' as const },
  { path: '/clients', label: 'Clients', icon: <IClients /> },
  { path: '/projets', label: 'Projets', icon: <IProjets /> },
  { path: '/finance', label: 'Finance', icon: <IFinance /> },
  { path: '/catalogue', label: 'Catalogue', icon: <ICatalogue /> },
]

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [acces, setAcces] = useState<Acces | null | undefined>(undefined)

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = db.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setAcces(session === null ? null : undefined); return }
    setAcces(undefined)
    db.rpc('mon_acces').then(({ data }) => setAcces((data as Acces[] | null)?.[0] ?? null))
  }, [session])

  if (session === undefined) return <Loading />
  if (!session) return <Login />
  if (acces === undefined) return <Loading />
  if (!acces) {
    return (
      <div className="login">
        <div className="card login-card">
          <h1>Accès non autorisé</h1>
          <p>Le compte <strong>{session.user.email}</strong> n'est pas membre de l'équipe Business Edge.</p>
          <button className="btn" onClick={() => db.auth.signOut()}>Se déconnecter</button>
        </div>
      </div>
    )
  }
  return <Shell acces={acces} />
}

function Shell({ acces }: { acces: Acces }) {
  const { path, params } = useRoute()
  const [ouvert, setOuvert] = useState(false)
  const [nouveaux, setNouveaux] = useState<number>(0)
  const racine = '/' + (path.split('/')[1] ?? '')
  const { theme, setTheme } = useTheme()

  useEffect(() => { setOuvert(false) }, [path])
  useEffect(() => {
    db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'New').is('fiche_maitre_id', null)
      .then(({ count }) => setNouveaux(count ?? 0))
  }, [path, params.toString()])

  let page
  switch (racine) {
    case '/pipeline': page = <Pipeline params={params} />; break
    case '/clients': page = <Clients params={params} />; break
    case '/projets': page = <Projets params={params} />; break
    case '/finance': page = <Finance params={params} />; break
    case '/catalogue': page = <Catalogue />; break
    case '/audit': page = <Audit params={params} />; break
    default: page = <Accueil />
  }

  return (
    <div className="app">
      <aside className={`sidebar ${ouvert ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">B</div>
          <div><div className="brand-name">Business Edge</div><div className="brand-sub">Workspace</div></div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.path} href={'#' + n.path} className={racine === n.path || (racine === '/audit' && n.path === '/pipeline') ? 'active' : ''}>
              {n.icon}{n.label}
              {n.badge === 'leads' && nouveaux > 0 && <span className="count">{nouveaux}</span>}
            </a>
          ))}
        </nav>
        <div className="theme-toggle" role="group" aria-label="Thème">
          <button className={theme === 'dark' ? 'on' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><IMoon /> Sombre</button>
          <button className={theme === 'light' ? 'on' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><ISun /> Clair</button>
        </div>
        <div className="sidebar-foot">
          <strong>{acces.nom ?? acces.email}</strong>
          {acces.email}
          <br /><button onClick={() => db.auth.signOut()}>Se déconnecter</button>
        </div>
      </aside>
      {ouvert && <div className="overlay" onClick={() => setOuvert(false)} />}
      <main className="main">
        <button className="btn ghost burger" onClick={() => setOuvert(true)} aria-label="Menu"><IMenu /> Menu</button>
        {page}
      </main>
    </div>
  )
}
