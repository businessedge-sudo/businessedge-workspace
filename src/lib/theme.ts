import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
const CLE = 'be-theme'

const lire = (): Theme => {
  try { return localStorage.getItem(CLE) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

/** Thème sombre par défaut, clair à la demande. Le choix est retenu sur cet appareil. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(lire)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') root.dataset.theme = 'light'
    else delete root.dataset.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F4F5F7' : '#0B0E11')
    try { localStorage.setItem(CLE, theme) } catch { /* navigation privée : le choix vaut pour la session */ }
  }, [theme])
  return { theme, setTheme }
}
