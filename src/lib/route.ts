import { useEffect, useState } from 'react'

/** Routage par ancre (#/pipeline?ouvrir=…) : aucune configuration serveur nécessaire. */
export function useRoute() {
  const lire = () => {
    const h = window.location.hash.replace(/^#/, '') || '/'
    const [path, query = ''] = h.split('?')
    return { path: path || '/', params: new URLSearchParams(query) }
  }
  const [r, setR] = useState(lire)
  useEffect(() => {
    const f = () => setR(lire())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}

export const go = (path: string, params?: Record<string, string>) => {
  const q = params ? '?' + new URLSearchParams(params).toString() : ''
  window.location.hash = path + q
}

/** Ferme un panneau ouvert par ?ouvrir= sans changer de page. */
export const fermer = (path: string) => { window.location.hash = path }
