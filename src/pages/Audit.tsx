import { useEffect, useMemo, useRef, useState } from 'react'
import { db, q } from '../lib/supabase'
import { date, money } from '../lib/format'
import { go } from '../lib/route'
import { AXES, calculer, type AuditOption, type AuditQuestion, type Palier, type Reponses, type ServiceTarif } from '../lib/audit'
import { PALIERS } from '../lib/referentiel'
import { Empty, Loading, Pill, useData, useToast } from '../components/ui'

type LeadAudit = {
  id: string; numero: number; company_name: string | null; contact_name: string | null; status: string; client_id: string | null
  business_overview: string | null; d1_activite: string | null; message_prospect: string | null
  audit_reponses: Reponses | null; audit_le: string | null
}

/** La fiche d'audit, remplie pendant l'appel. Chaque réponse est un fait ; le système en déduit le reste. */
export function Audit({ params }: { params: URLSearchParams }) {
  const id = params.get('lead')
  const toast = useToast()
  const { data, reload } = useData(async () => {
    if (!id) return null
    const [lead, questions, options, services, projets] = await Promise.all([
      q<LeadAudit>(db.from('leads').select('id, numero, company_name, contact_name, status, client_id, business_overview, d1_activite, message_prospect, audit_reponses, audit_le').eq('id', id).single()),
      q<AuditQuestion[]>(db.from('audit_questions').select('*').order('ordre')),
      q<AuditOption[]>(db.from('audit_options').select('*').order('ordre')),
      q<ServiceTarif[]>(db.from('services').select('id, nom, nom_commercial_fr, categorie, prix_standard, prix_medium, prix_premium').eq('actif', true).order('ordre')),
      q<{ id: string; signed: boolean }[]>(db.from('projects').select('id, signed').eq('lead_id', id).limit(1)),
    ])
    return { lead, questions, options, services, projet: projets[0] ?? null }
  }, [id])

  const [rep, setRep] = useState<Reponses>({})
  const [regles, setRegles] = useState(false)
  const [busy, setBusy] = useState(false)
  const charge = useRef<string | null>(null)
  useEffect(() => {
    if (data && charge.current !== data.lead.id) { setRep(data.lead.audit_reponses ?? {}); charge.current = data.lead.id }
  }, [data])

  const res = useMemo(() => (data ? calculer(data.questions, data.options, data.services, rep) : null), [data, rep])

  if (!id) return <Empty>Aucun lead sélectionné.</Empty>
  if (!data || !res) return <Loading />
  const { lead } = data

  const choisir = (qq: AuditQuestion, o: AuditOption) => {
    if (qq.type === 'multi') {
      const cur = Array.isArray(rep[qq.cle]) ? (rep[qq.cle] as string[]) : []
      setRep({ ...rep, [qq.cle]: cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id] })
    } else {
      setRep({ ...rep, [qq.cle]: rep[qq.cle] === o.id ? '' : o.id })
    }
  }
  const estChoisie = (qq: AuditQuestion, o: AuditOption) => (Array.isArray(rep[qq.cle]) ? (rep[qq.cle] as string[]).includes(o.id) : rep[qq.cle] === o.id)

  const sauver = async () => {
    setBusy(true)
    const maj: Record<string, unknown> = {
      audit_reponses: rep, audit_score: res.score, audit_axes: res.axes, audit_le: new Date().toISOString(),
      audit_proposition: { chemin: res.chemin, lignes: res.lignes.map(({ raisons: _r, ...l }) => l), total: res.total, heures_mois: res.heuresMois, notes: res.notes, budget: res.budget },
    }
    if (lead.status === 'New') maj.status = 'Business Audit'
    const { error } = await db.from('leads').update(maj).eq('id', lead.id)
    setBusy(false)
    if (error) { toast(error.message, true); return false }
    return true
  }

  const enregistrer = async () => { if (await sauver()) { toast('Fiche d’audit enregistrée'); reload() } }

  const preparer = async () => {
    if (!res.lignes.length) return toast('Renseignez au moins la situation et la taille.', true)
    if (data.projet?.signed) return toast('Le projet de ce lead est déjà signé : modifiez-le depuis Projets.', true)
    if (!(await sauver())) return
    setBusy(true)
    const systeme = res.lignes.find((l) => l.categorie === 'systeme')
    let projetId = data.projet?.id
    if (!projetId) {
      const { data: p, error } = await db.from('projects').insert({ lead_id: lead.id, client_id: lead.client_id, proposal_type: systeme?.palier ?? 'Standard', proposal_status: 'Not yet' }).select('id').single()
      if (error) { setBusy(false); return toast(error.message, true) }
      projetId = p.id
    } else {
      await db.from('projects').update({ proposal_type: systeme?.palier ?? 'Standard' }).eq('id', projetId)
      await db.from('project_services').delete().eq('project_id', projetId)
    }
    const { error } = await db.from('project_services').insert(res.lignes.map((l) => ({ project_id: projetId, service_id: l.service_id, palier: l.palier })))
    if (!error && ['New', 'Business Audit'].includes(lead.status)) await db.from('leads').update({ status: 'Potential Client' }).eq('id', lead.id)
    setBusy(false)
    if (error) return toast(error.message, true)
    toast('Proposition préparée')
    go('/projets', { ouvrir: projetId! })
  }

  const majOption = async (o: AuditOption, champs: Partial<AuditOption>) => {
    const { error } = await db.from('audit_options').update(champs).eq('id', o.id)
    if (error) return toast(error.message, true)
    reload()
  }

  const contexte = lead.d1_activite ?? lead.business_overview ?? lead.message_prospect
  const budgetCourt = res.budget != null && res.total > 0 && res.budget < res.total

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fiche d’audit · {lead.company_name ?? lead.contact_name ?? `Lead n°${lead.numero}`}</h1>
          <p>Posez les questions dans l’ordre, cochez les faits. Le palier, les modules et le prix se calculent en direct.{lead.audit_le && ` Dernier enregistrement : ${date(lead.audit_le, true)}.`}</p>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => go('/pipeline', { ouvrir: lead.id })}>Retour au lead</button>
          <button className={`btn ${regles ? 'on' : ''}`} onClick={() => setRegles(!regles)}>{regles ? 'Masquer les règles' : 'Modifier les règles'}</button>
          <button className="btn" disabled={busy} onClick={enregistrer}>Enregistrer</button>
          <button className="btn primary" disabled={busy} onClick={preparer}>Préparer la proposition</button>
        </div>
      </div>

      <div className="audit">
        <div className="audit-questions">
          {contexte && (
            <section className="card card-pad">
              <div className="section-title" style={{ marginTop: 0 }}>Ce que le prospect a écrit</div>
              <div className="prose">{contexte}</div>
            </section>
          )}
          {res.questions.map((qq, i) => {
            const opts = data.options.filter((o) => o.question_cle === qq.cle)
            const repondu = qq.type === 'texte' ? !!(rep[qq.cle] as string)?.trim?.() : Array.isArray(rep[qq.cle]) ? (rep[qq.cle] as string[]).length > 0 : !!rep[qq.cle]
            return (
              <section key={qq.cle} className={`card card-pad audit-q ${repondu ? 'done' : ''}`}>
                <div className="audit-q-head">
                  <span className="num">{i + 1}</span>
                  <div>
                    <div className="audit-q-title">{qq.libelle}</div>
                    {qq.aide && <div className="muted" style={{ fontSize: 12.5 }}>{qq.aide}{qq.type === 'multi' ? ' Plusieurs réponses possibles.' : ''}</div>}
                    {!qq.aide && qq.type === 'multi' && <div className="muted" style={{ fontSize: 12.5 }}>Plusieurs réponses possibles.</div>}
                  </div>
                </div>
                {qq.type === 'texte' ? (
                  <textarea className="input" rows={2} value={(rep[qq.cle] as string) ?? ''} onChange={(e) => setRep({ ...rep, [qq.cle]: e.target.value })} />
                ) : (
                  <div className="audit-opts">
                    {opts.map((o) => (
                      <div key={o.id} className="audit-opt-wrap">
                        <button className={`audit-opt ${estChoisie(qq, o) ? 'on' : ''}`} onClick={() => choisir(qq, o)}>{o.libelle}</button>
                        {regles && (
                          <div className="regle">
                            <select className="input" value={o.service_id ?? ''} onChange={(e) => majOption(o, { service_id: e.target.value || null, service_palier: e.target.value ? (o.service_palier ?? 'Standard') : null })}>
                              <option value="">Aucun service</option>
                              {data.services.filter((s) => s.categorie === 'module').map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                            </select>
                            {o.service_id && (
                              <select className="input" value={o.service_palier ?? 'Standard'} onChange={(e) => majOption(o, { service_palier: e.target.value as Palier })}>
                                {PALIERS.map((p) => <option key={p}>{p}</option>)}
                              </select>
                            )}
                            <select className="input" title="Palier minimum du système" value={o.palier_min_systeme ?? ''} onChange={(e) => majOption(o, { palier_min_systeme: (e.target.value || null) as Palier | null })}>
                              <option value="">Système : —</option>
                              {PALIERS.map((p) => <option key={p} value={p}>Système ≥ {p}</option>)}
                            </select>
                            {qq.axe && (
                              <select className="input" title="Points de maturité (3 = maîtrisé)" value={o.points ?? ''} onChange={(e) => majOption(o, { points: e.target.value === '' ? null : Number(e.target.value) })}>
                                <option value="">Points : —</option>
                                {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n} pt</option>)}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>

        <aside className="audit-side">
          <section className="card card-pad">
            <div className="section-title" style={{ marginTop: 0 }}>Maturité opérationnelle</div>
            <div className="score">
              <span className={res.score == null ? 'muted' : res.score < 40 ? 'red' : res.score < 70 ? 'gold' : 'green'}>{res.score ?? '—'}</span><small>/100</small>
            </div>
            {AXES.map(({ k, label }) => (
              <div key={k} className="axe">
                <span>{label}</span>
                <div className="axe-bar"><i style={{ width: `${((res.axes[k] ?? 0) / 20) * 100}%` }} /></div>
                <b>{res.axes[k] ?? '—'}</b>
              </div>
            ))}
            {res.heuresMois != null && <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>Environ <b style={{ color: 'var(--ink)' }}>{res.heuresMois} h par mois</b> perdues en ressaisie et relances.</p>}
          </section>

          <section className="card card-pad">
            <div className="section-title" style={{ marginTop: 0 }}>Proposition calculée</div>
            {res.lignes.length === 0 ? <div className="muted">Commencez par la situation et la taille de l’entreprise.</div> : (
              <>
                {res.lignes.map((l) => (
                  <div key={l.service_id} className="prop-line" title={l.raisons.join(' · ')}>
                    <div><div className="t">{l.nom}</div><div className="s">{l.palier}{l.raisons.length > 0 && ` · ${l.raisons[l.raisons.length - 1]}`}</div></div>
                    <span>{money(l.prix)}</span>
                  </div>
                ))}
                <div className="prop-total"><span>Total</span><span>{money(res.total)}</span></div>
                {budgetCourt && <div className="notice warn" style={{ marginTop: 10 }}>Budget annoncé ({res.budget === 0 ? 'aucun' : `≤ ${money(res.budget)}`}) sous le prix calculé. Réduire le périmètre ou relancer plus tard.</div>}
                {res.budget != null && !budgetCourt && res.total > 0 && <div style={{ marginTop: 10 }}><Pill ton="ok">Budget compatible</Pill></div>}
              </>
            )}
          </section>

          {res.notes.length > 0 && (
            <section className="card card-pad">
              <div className="section-title" style={{ marginTop: 0 }}>Constats à retenir</div>
              <ul className="notes">{res.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </section>
          )}

          <section className="card card-pad">
            <div className="section-title" style={{ marginTop: 0 }}>Avancement</div>
            <div className="muted" style={{ fontSize: 13 }}>{res.repondues} réponse(s) · {res.manquantes.length} question(s) restante(s)</div>
          </section>
        </aside>
      </div>
    </>
  )
}
