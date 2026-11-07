import { useMemo, useState } from 'react'
import { db, q } from '../lib/supabase'
import { date, money, since } from '../lib/format'
import { fermer, go } from '../lib/route'
import {
  LANGUES, LEAD_STATUTS, LEAD_STATUT_LIBELLE, LEAD_STATUT_TON, PERIODES_APPEL, PHASES_RELANCE, SOURCES, TENTATIVES,
} from '../lib/referentiel'
import { Empty, Field, Loading, Panel, Pill, Select, useData, useToast } from '../components/ui'
import { IPlus } from '../components/icons'

export type Lead = {
  id: string; numero: number; company_name: string | null; contact_name: string | null; email: string | null; phone: string | null
  source: string | null; status: string; client_language: string | null; type_entree: string | null
  periode_appels: string | null; tentatives_call: string | null; phase_relance: string | null; date_premier_mail: string | null
  creneau_reserve: string | null; message_prospect: string | null; business_overview: string | null; reponses_audit: string | null
  d1_activite: string | null; d2_parcours: string | null; d3_taches: string | null; d4_outils: string | null; d5_corvee: string | null
  synthese_ia: string | null; accuse_envoye_le: string | null; fiche_maitre_id: string | null; client_id: string | null; created_at: string
  audit_score: number | null; audit_le: string | null
  audit_proposition: { lignes: { nom: string; palier: string; prix: number }[]; total: number; heures_mois: number | null } | null
}

// Les colonnes visibles du pipeline. Disqualifiés et désistés restent accessibles via le filtre.
const COLONNES = ['New', 'Business Audit', 'Potential Client', 'Won'] as const

export function Pipeline({ params }: { params: URLSearchParams }) {
  const toast = useToast()
  const [recherche, setRecherche] = useState('')
  const [archives, setArchives] = useState(false)
  const [survol, setSurvol] = useState<string | null>(null)
  const { data: leads, reload } = useData(() =>
    q<Lead[]>(db.from('leads').select('*').order('created_at', { ascending: false })), [])

  const ouvrir = params.get('ouvrir')
  const nouveau = params.get('nouveau') === '1'

  const visibles = useMemo(() => {
    const t = recherche.trim().toLowerCase()
    return (leads ?? []).filter((l) => !l.fiche_maitre_id).filter((l) => !t ||
      [l.company_name, l.contact_name, l.email, l.phone].some((v) => v?.toLowerCase().includes(t)))
  }, [leads, recherche])

  if (!leads) return <Loading />

  const colonnes: readonly string[] = archives ? [...COLONNES, 'Disqualified', 'Retracted Client'] : COLONNES

  const deplacer = async (id: string, statut: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead || lead.status === statut) return
    const { error } = await db.from('leads').update({ status: statut }).eq('id', id)
    if (error) return toast(error.message, true)
    toast(statut === 'Won' ? 'Lead gagné : fiche client et projet créés.' : `Passé en « ${LEAD_STATUT_LIBELLE[statut]} »`)
    reload()
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Pipeline</h1><p>{visibles.length} lead(s) · glissez une carte pour changer son statut</p></div>
        <div className="actions">
          <input className="input search" placeholder="Rechercher un nom, une société, un email" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <label className="check"><input type="checkbox" checked={archives} onChange={(e) => setArchives(e.target.checked)} /> Archivés</label>
          <a className="btn primary" href="#/pipeline?nouveau=1"><IPlus /> Nouveau lead</a>
        </div>
      </div>

      <div className="board">
        {colonnes.map((col) => {
          const items = visibles.filter((l) => l.status === col)
          return (
            <div key={col} className={`column ${survol === col ? 'drop' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setSurvol(col) }}
              onDragLeave={() => setSurvol(null)}
              onDrop={(e) => { e.preventDefault(); setSurvol(null); deplacer(e.dataTransfer.getData('text/plain'), col) }}>
              <div className="column-head"><h3>{LEAD_STATUT_LIBELLE[col]}</h3><span className="n">{items.length}</span></div>
              <div className="column-body">
                {items.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: '6px 4px' }}>Aucun lead</div>}
                {items.map((l) => {
                  const doublons = leads.filter((d) => d.fiche_maitre_id === l.id).length
                  return (
                    <div key={l.id} className="lead-card" draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)}
                      onClick={() => go('/pipeline', { ouvrir: l.id })}>
                      <div className="t">{l.company_name ?? 'Sans société'}</div>
                      <div className="s">{l.contact_name ?? '—'}{l.email ? ` · ${l.email}` : ''}</div>
                      <div className="meta">
                        {l.type_entree && <Pill ton={l.type_entree === 'Diagnostic réservé' ? 'run' : 'info'}>{l.type_entree === 'Diagnostic réservé' ? 'Diagnostic' : 'Message'}</Pill>}
                        {l.source && l.source !== 'Website' && <Pill ton="mute">{l.source}</Pill>}
                        {doublons > 0 && <Pill ton="mute">+{doublons} doublon</Pill>}
                        <span className="muted">{since(l.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {ouvrir && <LeadPanel id={ouvrir} leads={leads} onClose={() => fermer('/pipeline')} onSaved={reload} />}
      {nouveau && <NouveauLead onClose={() => fermer('/pipeline')} onSaved={(id) => { reload(); go('/pipeline', { ouvrir: id }) }} />}
    </>
  )
}

function LeadPanel({ id, leads, onClose, onSaved }: { id: string; leads: Lead[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const initial = leads.find((l) => l.id === id)
  const [f, setF] = useState<Lead | undefined>(initial)
  const [busy, setBusy] = useState(false)
  const { data: projet } = useData(async () => {
    if (!initial?.client_id) return null
    const r = await q<{ id: string; project_code: string }[]>(db.from('v_projects').select('id, project_code').eq('lead_id', id).limit(1))
    return r[0] ?? null
  }, [id, initial?.client_id])

  if (!f || !initial) return <Panel title="Lead introuvable" onClose={onClose}><Empty>Ce lead n'existe plus.</Empty></Panel>
  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setF({ ...f, [k]: v })
  const doublons = leads.filter((d) => d.fiche_maitre_id === id)
  const maitre = f.fiche_maitre_id ? leads.find((l) => l.id === f.fiche_maitre_id) : null

  const enregistrer = async (extra: Partial<Lead> = {}) => {
    setBusy(true)
    const champs = ['company_name', 'contact_name', 'email', 'phone', 'source', 'status', 'client_language', 'periode_appels',
      'tentatives_call', 'phase_relance', 'business_overview', 'reponses_audit'] as const
    const maj: Record<string, unknown> = {}
    for (const k of champs) maj[k] = f[k]
    Object.assign(maj, extra)
    const { error } = await db.from('leads').update(maj).eq('id', id)
    setBusy(false)
    if (error) return toast(error.message, true)
    toast(extra.status === 'Won' ? 'Lead gagné : fiche client et projet créés.' : 'Enregistré')
    onSaved()
    if (extra.status === 'Won') onClose()
  }

  const diagnostic = [
    ['Son entreprise ou son projet', f.d1_activite], ['Parcours client', f.d2_parcours], ['Tâches répétitives', f.d3_taches],
    ['Outils en place', f.d4_outils], ['Corvée à supprimer', f.d5_corvee],
  ].filter(([, v]) => v)

  return (
    <Panel
      title={f.company_name ?? 'Sans société'}
      subtitle={<>Lead n°{f.numero} · reçu le {date(f.created_at, true)} · <Pill ton={LEAD_STATUT_TON[initial.status]}>{LEAD_STATUT_LIBELLE[initial.status]}</Pill></>}
      onClose={onClose}
      footer={<>
        {!f.fiche_maitre_id && <button className="btn" onClick={() => go('/audit', { lead: id })}>{f.audit_le ? 'Fiche d’audit' : 'Démarrer l’audit'}</button>}
        {initial.status !== 'Won' && !f.fiche_maitre_id && <button className="btn" disabled={busy} onClick={() => enregistrer({ status: 'Won' })}>Marquer gagné</button>}
        <button className="btn primary" disabled={busy} onClick={() => enregistrer()}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </>}
    >
      {maitre && (
        <div className="notice">Cette fiche est un doublon. La fiche qui fait foi est <a className="gold" href={`#/pipeline?ouvrir=${maitre.id}`}>{maitre.company_name ?? maitre.email}</a>.</div>
      )}
      {projet && (
        <div className="notice">Client gagné · projet <a className="gold" href={`#/projets?ouvrir=${projet.id}`}>{projet.project_code}</a></div>
      )}

      <section>
        <h3 className="section-title">Coordonnées</h3>
        <div className="form-grid">
          <Field label="Société"><input className="input" value={f.company_name ?? ''} onChange={(e) => set('company_name', e.target.value || null)} /></Field>
          <Field label="Contact"><input className="input" value={f.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value || null)} /></Field>
          <Field label="Email"><input className="input" type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value || null)} /></Field>
          <Field label="Téléphone / WhatsApp"><input className="input" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value || null)} /></Field>
          <Field label="Source"><Select value={f.source} options={SOURCES} onChange={(v) => set('source', v)} /></Field>
          <Field label="Langue"><Select value={f.client_language} options={LANGUES} onChange={(v) => set('client_language', v)} /></Field>
        </div>
        {f.phone && (
          <div className="actions" style={{ marginTop: 10 }}>
            <a className="btn sm" target="_blank" rel="noreferrer" href={`https://wa.me/${f.phone.replace(/\D/g, '')}`}>Écrire sur WhatsApp</a>
            {f.email && <a className="btn sm" href={`mailto:${f.email}`}>Écrire un email</a>}
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title">Suivi</h3>
        <div className="form-grid">
          <Field label="Statut"><Select value={f.status} options={LEAD_STATUTS} labels={LEAD_STATUT_LIBELLE} allowEmpty={false} onChange={(v) => set('status', v ?? 'New')} /></Field>
          <Field label="Relance"><Select value={f.phase_relance} options={PHASES_RELANCE} onChange={(v) => set('phase_relance', v)} /></Field>
          <Field label="Période d'appel"><Select value={f.periode_appels} options={PERIODES_APPEL} onChange={(v) => set('periode_appels', v)} /></Field>
          <Field label="Tentatives d'appel"><Select value={f.tentatives_call} options={TENTATIVES} onChange={(v) => set('tentatives_call', v)} /></Field>
        </div>
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>Porte d'entrée</dt><dd>{f.type_entree ?? 'Saisie manuelle'}</dd>
          <dt>Créneau réservé</dt><dd>{date(f.creneau_reserve, true)}</dd>
          <dt>Accusé envoyé</dt><dd>{date(f.accuse_envoye_le, true)}</dd>
          <dt>Premier mail</dt><dd>{date(f.date_premier_mail)}</dd>
        </dl>
      </section>

      {f.message_prospect && (
        <section><h3 className="section-title">Message du prospect</h3><div className="prose">{f.message_prospect}</div></section>
      )}

      {f.audit_le && f.audit_proposition && (
        <section>
          <h3 className="section-title">Audit · {date(f.audit_le, true)}</h3>
          <div className="totals card card-pad">
            <div><span>Maturité opérationnelle</span><span className="strong">{f.audit_score ?? '—'} / 100</span></div>
            {f.audit_proposition.lignes.map((l) => <div key={l.nom}><span>{l.nom} · {l.palier}</span><span>{money(l.prix)}</span></div>)}
            <div className="grand"><span>Prix calculé</span><span>{money(f.audit_proposition.total)}</span></div>
          </div>
        </section>
      )}

      {diagnostic.length > 0 && (
        <section>
          <h3 className="section-title">Ce que le prospect a écrit</h3>
          <div className="qa">{diagnostic.map(([q, a]) => <div key={q}><div className="q">{q}</div><div className="a">{a}</div></div>)}</div>
        </section>
      )}

      {f.synthese_ia && <section><h3 className="section-title">Synthèse IA (avant l'appel)</h3><div className="prose">{f.synthese_ia}</div></section>}

      <section>
        <h3 className="section-title">Notes d'audit</h3>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <Field label="Activité et équipe (notes)"><textarea className="input" value={f.business_overview ?? ''} onChange={(e) => set('business_overview', e.target.value || null)} /></Field>
          <Field label="Réponses d'audit (style télégraphique)"><textarea className="input" style={{ minHeight: 140 }} value={f.reponses_audit ?? ''} onChange={(e) => set('reponses_audit', e.target.value || null)} /></Field>
        </div>
      </section>

      {doublons.length > 0 && (
        <section>
          <h3 className="section-title">Doublons rattachés ({doublons.length})</h3>
          <div className="qa">
            {doublons.map((d) => (
              <div key={d.id}><div className="q">{date(d.created_at, true)} · {d.type_entree ?? 'saisie'}</div><div className="a">{d.message_prospect ?? '(pas de message)'}</div></div>
            ))}
          </div>
        </section>
      )}
    </Panel>
  )
}

function NouveauLead({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast()
  const [f, setF] = useState({ company_name: '', contact_name: '', email: '', phone: '', source: 'Referral', client_language: 'Français', message_prospect: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })

  const creer = async () => {
    if (!f.company_name && !f.contact_name) return toast('Indiquez au moins une société ou un contact.', true)
    setBusy(true)
    const ligne = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]))
    if (ligne.email) ligne.email = String(ligne.email).toLowerCase()
    // Saisie manuelle : pas de « type d'entrée » (réservé aux formulaires), statut Nouveau.
    const { data, error } = await db.from('leads').insert({ ...ligne, status: 'New', message_prospect: null, business_overview: ligne.message_prospect }).select('id').single()
    setBusy(false)
    if (error) return toast(error.message, true)
    toast('Lead créé')
    onSaved(data.id)
  }

  return (
    <Panel title="Nouveau lead" subtitle="Saisie manuelle : recommandation, appel, salon…" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" disabled={busy} onClick={creer}>Créer le lead</button></>}>
      <div className="form-grid">
        <Field label="Société"><input className="input" autoFocus value={f.company_name} onChange={(e) => set('company_name', e.target.value)} /></Field>
        <Field label="Contact"><input className="input" value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Téléphone / WhatsApp"><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Source"><Select value={f.source} options={SOURCES} allowEmpty={false} onChange={(v) => set('source', v ?? 'Other')} /></Field>
        <Field label="Langue"><Select value={f.client_language} options={LANGUES} allowEmpty={false} onChange={(v) => set('client_language', v ?? 'Français')} /></Field>
      </div>
      <Field label="Contexte"><textarea className="input" value={f.message_prospect} onChange={(e) => set('message_prospect', e.target.value)} placeholder="Qui l'a recommandé, ce qu'il cherche…" /></Field>
    </Panel>
  )
}
