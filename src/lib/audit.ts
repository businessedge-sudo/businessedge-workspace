/** Moteur de la fiche d'audit : des réponses factuelles vers un score, des services, des paliers et un prix.
 *  Les règles vivent dans la base (audit_options) : ce fichier ne contient aucune règle métier. */

export type Palier = 'Standard' | 'Medium' | 'Premium'
export type Axe = 'donnees' | 'commercial' | 'production' | 'finance' | 'autonomie'

export type AuditQuestion = {
  cle: string; ordre: number; chemin: 'commun' | 'activite' | 'projet'; type: 'choix' | 'multi' | 'texte'
  axe: Axe | null; libelle: string; aide: string | null; actif: boolean
}
export type AuditOption = {
  id: string; question_cle: string; ordre: number; libelle: string; code: string | null; points: number | null
  service_id: string | null; service_palier: Palier | null; palier_min_systeme: Palier | null
  heures: number | null; valeur: number | null; note: string | null
}
export type ServiceTarif = {
  id: string; nom: string; nom_commercial_fr: string | null; categorie: string
  prix_standard: number; prix_medium: number; prix_premium: number
}
export type Reponses = Record<string, string | string[]>

export type Ligne = { service_id: string; nom: string; categorie: string; palier: Palier; prix: number; raisons: string[] }
export type Resultat = {
  chemin: 'activite' | 'projet' | null
  questions: AuditQuestion[]
  repondues: number
  score: number | null
  axes: Record<Axe, number | null>
  lignes: Ligne[]
  total: number
  heuresMois: number | null
  notes: string[]
  budget: number | null
  manquantes: string[]
}

export const AXES: { k: Axe; label: string }[] = [
  { k: 'donnees', label: 'Données' },
  { k: 'commercial', label: 'Commercial' },
  { k: 'production', label: 'Production' },
  { k: 'finance', label: 'Finance' },
  { k: 'autonomie', label: 'Autonomie' },
]

const RANG: Record<Palier, number> = { Standard: 1, Medium: 2, Premium: 3 }
const plusHaut = (a: Palier | undefined, b: Palier) => (!a || RANG[b] > RANG[a] ? b : a)
export const prixAuPalier = (s: ServiceTarif, p: Palier) =>
  Number(p === 'Premium' ? s.prix_premium : p === 'Medium' ? s.prix_medium : s.prix_standard)

const choisies = (r: string | string[] | undefined): string[] => (Array.isArray(r) ? r : r ? [r] : [])

export function calculer(questions: AuditQuestion[], options: AuditOption[], services: ServiceTarif[], reponses: Reponses): Resultat {
  const parId = new Map(options.map((o) => [o.id, o]))
  const situation = choisies(reponses.situation).map((id) => parId.get(id)?.code)[0]
  const chemin = situation === 'activite' || situation === 'projet' ? situation : null

  const actives = questions
    .filter((q) => q.actif && (q.chemin === 'commun' || q.chemin === chemin))
    .sort((a, b) => a.ordre - b.ordre)

  const pts: Record<Axe, { got: number; max: number }> = {
    donnees: { got: 0, max: 0 }, commercial: { got: 0, max: 0 }, production: { got: 0, max: 0 }, finance: { got: 0, max: 0 }, autonomie: { got: 0, max: 0 },
  }
  const paliers = new Map<string, Palier>()
  const raisons = new Map<string, string[]>()
  const notes: string[] = []
  let palierSysteme: Palier | undefined
  let heures: number | null = null
  let budget: number | null = null
  let repondues = 0
  const manquantes: string[] = []

  for (const q of actives) {
    const r = reponses[q.cle]
    if (q.type === 'texte') {
      if (typeof r === 'string' && r.trim()) repondues++
      else if (q.cle !== 'situation') manquantes.push(q.libelle)
      continue
    }
    const opts = choisies(r).map((id) => parId.get(id)).filter((o): o is AuditOption => !!o)
    if (!opts.length) { if (q.cle !== 'situation') manquantes.push(q.libelle); continue }
    repondues++
    for (const o of opts) {
      if (q.axe && o.points != null) { pts[q.axe].got += o.points; pts[q.axe].max += 3 }
      if (o.palier_min_systeme) palierSysteme = plusHaut(palierSysteme, o.palier_min_systeme)
      if (o.service_id && o.service_palier) {
        paliers.set(o.service_id, plusHaut(paliers.get(o.service_id), o.service_palier))
        raisons.set(o.service_id, [...(raisons.get(o.service_id) ?? []), o.libelle])
      }
      if (o.heures != null) heures = Number(o.heures)
      if (q.cle === 'budget' && o.valeur != null) budget = Number(o.valeur)
      if (o.note && !notes.includes(o.note)) notes.push(o.note)
    }
  }

  // Le système de pilotage est toujours la base de la proposition dès que la situation est connue.
  const systeme = services.find((s) => s.categorie === 'systeme')
  if (chemin && systeme) {
    paliers.set(systeme.id, plusHaut(paliers.get(systeme.id), palierSysteme ?? 'Standard'))
    raisons.set(systeme.id, ['Socle de toute proposition', ...(raisons.get(systeme.id) ?? [])])
  }

  const ordre = (c: string) => (c === 'systeme' ? 0 : c === 'module' ? 1 : 2)
  const lignes: Ligne[] = [...paliers.entries()]
    .map(([id, palier]) => {
      const s = services.find((x) => x.id === id)
      if (!s) return null
      return { service_id: id, nom: s.nom_commercial_fr ?? s.nom, categorie: s.categorie, palier, prix: prixAuPalier(s, palier), raisons: raisons.get(id) ?? [] }
    })
    .filter((l): l is Ligne => !!l)
    .sort((a, b) => ordre(a.categorie) - ordre(b.categorie) || b.prix - a.prix)

  const axes = Object.fromEntries(AXES.map(({ k }) => [k, pts[k].max ? Math.round((pts[k].got / pts[k].max) * 20) : null])) as Record<Axe, number | null>
  const totMax = AXES.reduce((t, { k }) => t + pts[k].max, 0)
  const totGot = AXES.reduce((t, { k }) => t + pts[k].got, 0)

  return {
    chemin, questions: actives, repondues,
    score: totMax ? Math.round((totGot / totMax) * 100) : null,
    axes, lignes,
    total: lignes.reduce((t, l) => t + l.prix, 0),
    heuresMois: heures != null ? Math.round(heures * 4.33) : null,
    notes, budget, manquantes,
  }
}
