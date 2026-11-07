const usd = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 })
const usd2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2 })

export const money = (v: unknown, cents = false) => {
  const n = Number(v ?? 0)
  // Espace insécable classique : l'espace fine (U+202F) n'existe pas dans toutes les polices de titre.
  return (cents ? usd2 : usd).format(Number.isFinite(n) ? n : 0).replace(/\u202f/g, '\u00a0')
}

export const date = (v: string | null | undefined, withTime = false) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' })
}

/** « il y a 3 j », « aujourd'hui » : lecture rapide d'une ancienneté. */
export const since = (v: string | null | undefined) => {
  if (!v) return '—'
  const j = Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000)
  if (j <= 0) return "aujourd'hui"
  if (j === 1) return 'hier'
  if (j < 30) return `il y a ${j} j`
  const m = Math.floor(j / 30)
  return `il y a ${m} mois`
}

export const toInputDate = (v: string | null | undefined) => (v ? v.slice(0, 10) : '')
