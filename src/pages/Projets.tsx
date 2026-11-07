import { useEffect, useMemo, useState } from 'react'
import { db, q } from '../lib/supabase'
import { date, money, toInputDate } from '../lib/format'
import { fermer, go } from '../lib/route'
import {
  CATEGORIE_LIBELLE, DELIVERY, DELIVERY_LIBELLE, MOTIFS_REMISE, PALIERS, PLATEFORMES, PROPOSAL_LIBELLE, PROPOSAL_STATUS, TACHE_STATUTS, TACHE_TON,
} from '../lib/referentiel'
import { Bar, Empty, Field, Loading, Panel, Pill, Select, useData, useToast } from '../components/ui'

type Projet = {
  id: string; project_code: string; client_id: string | null; lead_id: string | null; delivery_status: string | null
  proposal_status: string | null; proposal_type: string | null; signed: boolean; done: boolean; remise_pct: number | null
  motif_remise: string | null; launch_date: string | null; estimated_delivery_date: string | null; next_milestone: string | null
  deliverables_url: string | null; contrat_signe_url: string | null; plateforme: string | null; prix_catalogue: number; montant_du: number; montant_remise: number
  nb_taches: number; nb_taches_faites: number; avancement_pct: number; lignes_fr: string | null; created_at: string
}
type Service = {
  id: string; nom: string; nom_commercial_fr: string | null; categorie: string; actif: boolean; master_template: boolean
  prix_standard: number; prix_medium: number; prix_premium: number
  perimetre_standard: string | null; perimetre_medium: string | null; perimetre_premium: string | null
}
type Tache = { id: string; nom: string; statut: string; terminee: boolean; phase: string | null; ordre: number | null; echeance: string | null; service_id: string | null }

export function Projets({ params }: { params: URLSearchParams }) {
  const [filtre, setFiltre] = useState<'cours' | 'vente' | 'clos' | 'tous'>('cours')
  const { data, reload } = useData(async () => {
    const [projets, clients] = await Promise.all([
      q<Projet[]>(db.from('v_projects').select('*').order('created_at', { ascending: false })),
      q<{ id: string; client_code: string }[]>(db.from('v_clients').select('id, client_code')),
    ])
    return { projets, clients: new Map(clients.map((c) => [c.id, c.client_code])) }
  })
  const ouvrir = params.get('ouvrir')
  if (!data) return <Loading />

  const auj = new Date().toISOString().slice(0, 10)
  const liste = data.projets.filter((p) =>
    filtre === 'tous' ? true : filtre === 'clos' ? p.done : filtre === 'vente' ? !p.signed && !p.done : p.signed && !p.done)

  return (
    <>
      <div className="page-head">
        <div><h1>Projets</h1><p>Un projet naît quand un lead passe en « Gagné ». La checklist de production se génère à la signature.</p></div>
        <div className="chips">
          {([['cours', 'En production'], ['vente', 'En vente'], ['clos', 'Clôturés'], ['tous', 'Tous']] as const).map(([k, l]) => (
            <button key={k} className={`chip ${filtre === k ? 'on' : ''}`} onClick={() => setFiltre(k)}>{l}</button>
          ))}
        </div>
      </div>

      <section className="card">
        {liste.length === 0 ? <Empty>Aucun projet dans cette vue.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Projet</th><th>Client</th><th>Étape</th><th>Palier</th><th className="num">Montant dû</th><th>Avancement</th><th>Livraison</th></tr></thead>
              <tbody>
                {liste.map((p) => {
                  const retard = !p.done && p.estimated_delivery_date && p.estimated_delivery_date.slice(0, 10) < auj
                  return (
                    <tr key={p.id} className="clickable" onClick={() => go('/projets', { ouvrir: p.id })}>
                      <td><span className="strong">{p.project_code}</span></td>
                      <td>{p.client_id ? data.clients.get(p.client_id) : '—'}</td>
                      <td>{p.done ? <Pill ton="ok">Clôturé</Pill> : p.signed ? <Pill ton="run">{DELIVERY_LIBELLE[p.delivery_status ?? ''] ?? 'Signé'}</Pill> : <Pill ton="info">{PROPOSAL_LIBELLE[p.proposal_status ?? ''] ?? 'Proposition à faire'}</Pill>}</td>
                      <td>{p.proposal_type ?? <span className="muted">à choisir</span>}</td>
                      <td className="num strong">{money(p.montant_du)}</td>
                      <td style={{ minWidth: 130 }}>{p.nb_taches ? <Bar pct={p.avancement_pct} /> : <span className="muted">—</span>}</td>
                      <td className={retard ? 'red' : ''}>{date(p.estimated_delivery_date)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ouvrir && <ProjetPanel id={ouvrir} clientCode={(cid) => data.clients.get(cid)} onClose={() => fermer('/projets')} onSaved={reload} />}
    </>
  )
}

function ProjetPanel({ id, clientCode, onClose, onSaved }: { id: string; clientCode: (id: string) => string | undefined; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const { data, reload } = useData(async () => {
    const [p, services, choisis, taches] = await Promise.all([
      q<Projet>(db.from('v_projects').select('*').eq('id', id).single()),
      q<Service[]>(db.from('services').select('id, nom, nom_commercial_fr, categorie, actif, master_template, prix_standard, prix_medium, prix_premium, perimetre_standard, perimetre_medium, perimetre_premium').neq('categorie', 'abonnement').order('ordre')),
      q<{ service_id: string; palier: string | null }[]>(db.from('project_services').select('service_id, palier').eq('project_id', id)),
      q<Tache[]>(db.from('tasks').select('id, nom, statut, terminee, phase, ordre, echeance, service_id').eq('project_id', id).order('phase').order('ordre')),
    ])
    return { p, services, choisis: new Set(choisis.map((c) => c.service_id)), paliers: new Map(choisis.map((c) => [c.service_id, c.palier])), taches }
  }, [id])
  const [f, setF] = useState<Projet | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (data) setF(data.p) }, [data])

  const prixService = (s: Service, palier: string | null) =>
    palier === 'Premium' ? s.prix_premium : palier === 'Medium' ? s.prix_medium : s.prix_standard
  const apercu = useMemo(() => {
    if (!data || !f) return { catalogue: 0, du: 0 }
    const catalogue = data.services.filter((s) => data.choisis.has(s.id)).reduce((t, s) => t + Number(prixService(s, data.paliers.get(s.id) ?? f.proposal_type)), 0)
    const remise = Math.min(Math.max(Number(f.remise_pct ?? 0), 0), 100)
    return { catalogue: f.proposal_type ? catalogue : 0, du: f.proposal_type ? Math.round(catalogue * (1 - remise / 100) * 100) / 100 : 0 }
  }, [data, f])

  if (!data || !f) return <Panel title="Projet" onClose={onClose}><Loading /></Panel>
  const set = <K extends keyof Projet>(k: K, v: Projet[K]) => setF({ ...f, [k]: v })

  const basculerService = async (sid: string) => {
    const op = data.choisis.has(sid)
      ? db.from('project_services').delete().eq('project_id', id).eq('service_id', sid)
      : db.from('project_services').insert({ project_id: id, service_id: sid })
    const { error } = await op
    if (error) return toast(error.message, true)
    reload(); onSaved()
  }

  const changerPalierLigne = async (sid: string, palier: string | null) => {
    const { error } = await db.from('project_services').update({ palier }).eq('project_id', id).eq('service_id', sid)
    if (error) return toast(error.message, true)
    reload(); onSaved()
  }

  const enregistrer = async (extra: Partial<Projet> = {}) => {
    const remise = Number(f.remise_pct ?? 0)
    if (remise > 0 && !f.motif_remise) return toast('Une remise doit porter un motif.', true)
    setBusy(true)
    const maj = {
      proposal_type: f.proposal_type, proposal_status: f.proposal_status, delivery_status: f.delivery_status,
      remise_pct: f.remise_pct, motif_remise: remise > 0 ? f.motif_remise : null,
      launch_date: f.launch_date, estimated_delivery_date: f.estimated_delivery_date, next_milestone: f.next_milestone,
      deliverables_url: f.deliverables_url, contrat_signe_url: f.contrat_signe_url, plateforme: f.plateforme, done: f.done, ...extra,
    }
    const { error } = await db.from('projects').update(maj).eq('id', id)
    setBusy(false)
    if (error) return toast(error.message, true)
    toast(extra.signed ? 'Projet signé : checklist de production générée.' : 'Enregistré')
    reload(); onSaved()
  }

  const signer = () => {
    if (!data.choisis.size) return toast('Choisissez au moins un service avant de signer.', true)
    if (!f.proposal_type) return toast('Choisissez un palier avant de signer.', true)
    const vendus = data.services.filter((s) => data.choisis.has(s.id))
    if (vendus.some((s) => s.categorie !== 'diagnostic') && !f.plateforme) return toast('Choisissez la plateforme (Supabase ou Airtable) avant de signer.', true)
    enregistrer({ signed: true, delivery_status: f.delivery_status ?? 'VERIFICATION', proposal_status: 'Sent' })
  }

  const facturer = async () => {
    if (!f.client_id) return toast('Projet sans client.', true)
    const { data: inv, error } = await db.from('invoices').insert({
      client_id: f.client_id, project_id: id, amount: data.p.montant_du, proposal_type: f.proposal_type, payment_status: 'Drafts',
    }).select('id').single()
    if (error) return toast(error.message, true)
    toast('Facture brouillon créée')
    go('/finance', { onglet: 'factures', ouvrir: inv.id })
  }

  const majTache = async (t: Tache, champs: Partial<Tache>) => {
    if (champs.terminee !== undefined) champs.statut = champs.terminee ? 'Fait' : (t.statut === 'Fait' ? 'En cours' : t.statut)
    if (champs.statut !== undefined && champs.terminee === undefined) champs.terminee = champs.statut === 'Fait'
    const { error } = await db.from('tasks').update(champs).eq('id', t.id)
    if (error) return toast(error.message, true)
    reload(); onSaved()
  }

  const p = data.p
  return (
    <Panel
      title={p.project_code}
      subtitle={<>{f.client_id ? <a className="gold" href={`#/clients?ouvrir=${f.client_id}`}>{clientCode(f.client_id)}</a> : 'Sans client'} · créé le {date(p.created_at)}</>}
      onClose={onClose}
      footer={<>
        {p.signed && <button className="btn" onClick={facturer}>Créer la facture</button>}
        {!p.signed && <button className="btn" disabled={busy} onClick={signer}>Marquer signé</button>}
        <button className="btn primary" disabled={busy} onClick={() => enregistrer()}>Enregistrer</button>
      </>}
    >
      <section>
        <h3 className="section-title">Solutions vendues</h3>
        <div className="chips" style={{ marginBottom: 10 }}>
          {PALIERS.map((pl) => <button key={pl} className={`chip ${f.proposal_type === pl ? 'on' : ''}`} onClick={() => set('proposal_type', pl)}>{pl}</button>)}
        </div>
        {(['diagnostic', 'systeme', 'module'] as const).map((cat) => {
          const items = data.services.filter((s) => s.categorie === cat && (s.actif || data.choisis.has(s.id)))
          if (!items.length) return null
          return (
            <div key={cat}>
              <div className="service-group-title">{CATEGORIE_LIBELLE[cat]}</div>
              <div className="grid" style={{ gap: 6 }}>
                {items.map((s) => {
                  const on = data.choisis.has(s.id)
                  const pl = data.paliers.get(s.id) ?? f.proposal_type
                  const per = pl === 'Premium' ? s.perimetre_premium : pl === 'Medium' ? s.perimetre_medium : s.perimetre_standard
                  return (
                    <div key={s.id} className={`service-row has-per ${on ? 'on' : ''}`} onClick={() => !p.signed && basculerService(s.id)}
                      title={p.signed ? 'Projet signé : les services sont figés' : 'Cliquer pour ajouter ou retirer'}>
                      <div>
                        <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{s.nom_commercial_fr ?? s.nom}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{s.nom}{!s.master_template && ' · construit à la demande'}</div>
                      </div>
                      <span className="price">
                        {on && !p.signed && (
                          <select className="input palier-ligne" value={data.paliers.get(s.id) ?? ''} onClick={(e) => e.stopPropagation()} onChange={(e) => changerPalierLigne(s.id, e.target.value || null)}>
                            <option value="">Palier du projet</option>
                            {PALIERS.map((x) => <option key={x}>{x}</option>)}
                          </select>
                        )}
                        {on && p.signed && data.paliers.get(s.id) && <span className="muted" style={{ marginRight: 8 }}>{data.paliers.get(s.id)}</span>}
                        {money(prixService(s, pl ?? 'Standard'))}
                      </span>
                      {on && per && <div className="per">{per}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {(() => {
          const vendus = data.services.filter((s) => data.choisis.has(s.id))
          const modules = vendus.some((s) => s.categorie === 'module')
          const systeme = vendus.some((s) => s.categorie === 'systeme')
          return modules && !systeme ? <div className="notice" style={{ marginTop: 10 }}>Des modules sans le système de pilotage : à réserver aux clients déjà équipés.</div> : null
        })()}
        <div className="service-group-title">Plateforme</div>
        <div className="chips">
          {PLATEFORMES.map((pl) => <button key={pl} className={`chip ${f.plateforme === pl ? 'on' : ''}`} onClick={() => set('plateforme', f.plateforme === pl ? null : pl)}>{pl}</button>)}
        </div>
      </section>

      <section>
        <h3 className="section-title">Prix</h3>
        <div className="form-grid">
          <Field label="Remise (%)"><input className="input" type="number" min={0} max={100} value={f.remise_pct ?? ''} onChange={(e) => set('remise_pct', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Motif de la remise"><Select value={f.motif_remise} options={MOTIFS_REMISE} onChange={(v) => set('motif_remise', v)} /></Field>
        </div>
        <div className="totals card card-pad" style={{ marginTop: 12 }}>
          <div><span>Prix catalogue</span><span className={Number(f.remise_pct) > 0 ? 'strike' : ''}>{money(apercu.catalogue)}</span></div>
          {Number(f.remise_pct) > 0 && <div><span>Remise {f.remise_pct} %</span><span className="red">−{money(apercu.catalogue - apercu.du)}</span></div>}
          <div className="grand"><span>Montant dû</span><span>{money(apercu.du)}</span></div>
          {!f.proposal_type && <div className="muted" style={{ fontSize: 12.5 }}>Choisissez un palier pour calculer le prix.</div>}
        </div>
      </section>

      <section>
        <h3 className="section-title">Suivi</h3>
        <div className="form-grid">
          <Field label="Proposition"><Select value={f.proposal_status} options={PROPOSAL_STATUS} labels={PROPOSAL_LIBELLE} onChange={(v) => set('proposal_status', v)} /></Field>
          <Field label="Étape de production"><Select value={f.delivery_status} options={DELIVERY} labels={DELIVERY_LIBELLE} onChange={(v) => set('delivery_status', v)} /></Field>
          <Field label="Lancement"><input className="input" type="date" value={toInputDate(f.launch_date)} onChange={(e) => set('launch_date', e.target.value || null)} /></Field>
          <Field label="Livraison prévue"><input className="input" type="date" value={toInputDate(f.estimated_delivery_date)} onChange={(e) => set('estimated_delivery_date', e.target.value || null)} /></Field>
          <Field label="Prochain jalon"><input className="input" value={f.next_milestone ?? ''} onChange={(e) => set('next_milestone', e.target.value || null)} /></Field>
          <Field label="Livrables (lien)"><input className="input" value={f.deliverables_url ?? ''} onChange={(e) => set('deliverables_url', e.target.value || null)} /></Field>
          <Field label="Contrat signé (lien)"><input className="input" value={f.contrat_signe_url ?? ''} onChange={(e) => set('contrat_signe_url', e.target.value || null)} /></Field>
        </div>
        <label className="check" style={{ marginTop: 12 }}><input type="checkbox" checked={f.done} onChange={(e) => set('done', e.target.checked)} /> Projet clôturé (livré et support 30 jours terminé)</label>
      </section>

      <section>
        <h3 className="section-title">Checklist de production {p.nb_taches ? `· ${p.nb_taches_faites}/${p.nb_taches}` : ''}</h3>
        {p.nb_taches > 0 && <div style={{ marginBottom: 10 }}><Bar pct={p.avancement_pct} /></div>}
        {data.taches.length === 0 ? (
          <div className="notice">{p.signed ? 'Aucune étape modèle pour les services de ce projet.' : 'La checklist se génère automatiquement quand le projet est marqué signé.'}</div>
        ) : (
          <div>
            {data.taches.map((t) => (
              <div key={t.id} className={`task ${t.terminee ? 'done' : ''}`}>
                <input type="checkbox" checked={t.terminee} onChange={(e) => majTache(t, { terminee: e.target.checked })} style={{ accentColor: 'var(--brand-500)', width: 16, height: 16 }} />
                <div><div className="n">{t.nom}</div><div className="ph">{t.phase}</div></div>
                <select className="input" style={{ height: 30, width: 120, fontSize: 12.5 }} value={t.statut} onChange={(e) => majTache(t, { statut: e.target.value })}>
                  {TACHE_STATUTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        {data.taches.some((t) => t.statut === 'Bloqué') && <div style={{ marginTop: 10 }}><Pill ton={TACHE_TON['Bloqué']}>{data.taches.filter((t) => t.statut === 'Bloqué').length} tâche(s) bloquée(s)</Pill></div>}
      </section>
    </Panel>
  )
}
