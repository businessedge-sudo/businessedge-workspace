import { useEffect, useState } from 'react'
import { db, q } from '../lib/supabase'
import { date, money, toInputDate } from '../lib/format'
import { fermer, go } from '../lib/route'
import {
  ABO_LIBELLE, ABO_STATUTS, ABO_TON, CYCLE_LIBELLE, CYCLES, FACTURE_LIBELLE, FACTURE_STATUTS, FACTURE_TON, METHODES, PALIERS, PLAN_LIBELLE, PLANS,
} from '../lib/referentiel'
import { Empty, Field, Kpi, Loading, Panel, Pill, Select, useData, useToast } from '../components/ui'

type Facture = {
  id: string; invoice_number: string; client_id: string; project_id: string | null; subscription_id: string | null; amount: number
  payment_status: string; proposal_type: string | null; date_issued: string | null; due_date: string | null; invoice_file_url: string | null
  notes: string | null; montant_facturable: number; encaisse: number; reste_du: number; created_at: string
}
type Paiement = { id: string; invoice_id: string; reference: string | null; montant: number; date_paiement: string; methode: string | null; notes: string | null }
type Abo = {
  id: string; subscription_code: string; client_id: string; plan_type: string; billing_cycle: string; status: string; amount: number
  start_date: string | null; next_renewal_date: string | null; mrr: number
}
type ClientRef = { id: string; label: string }
type Onglet = 'factures' | 'paiements' | 'abonnements'

const ONGLETS: [Onglet, string][] = [['factures', 'Factures'], ['paiements', 'Paiements'], ['abonnements', 'Abonnements']]

export function Finance({ params }: { params: URLSearchParams }) {
  const onglet = (params.get('onglet') as Onglet) || 'factures'
  const ouvrir = params.get('ouvrir')
  const nouvelle = params.get('nouvelle') === '1'
  const clientParam = params.get('client')

  const { data, reload } = useData(async () => {
    const [factures, paiements, abos, clients, leads] = await Promise.all([
      q<Facture[]>(db.from('v_invoices').select('*').order('created_at', { ascending: false })),
      q<Paiement[]>(db.from('payments').select('*').order('date_paiement', { ascending: false })),
      q<Abo[]>(db.from('v_subscriptions').select('*').order('created_at', { ascending: false })),
      q<{ id: string; client_code: string; contact_name: string | null }[]>(db.from('v_clients').select('id, client_code, contact_name').order('numero')),
      q<{ client_id: string; company_name: string | null }[]>(db.from('leads').select('client_id, company_name').not('client_id', 'is', null).is('fiche_maitre_id', null)),
    ])
    const soc = new Map<string, string>()
    leads.forEach((l) => { if (l.company_name && !soc.has(l.client_id)) soc.set(l.client_id, l.company_name) })
    const refs: ClientRef[] = clients.map((c) => ({ id: c.id, label: `${soc.get(c.id) ?? c.contact_name ?? 'Client'} · ${c.client_code}` }))
    return { factures, paiements, abos, clients: refs, nomClient: new Map(refs.map((r) => [r.id, r.label])) }
  })
  if (!data) return <Loading />

  const auj = new Date().toISOString().slice(0, 10)
  const facturable = data.factures.reduce((s, f) => s + Number(f.montant_facturable), 0)
  const encaisse = data.factures.reduce((s, f) => s + Number(f.encaisse), 0)
  const reste = data.factures.reduce((s, f) => s + Math.max(0, Number(f.reste_du)), 0)
  const retard = data.factures.filter((f) => Number(f.reste_du) > 0 && f.due_date && f.due_date < auj && f.payment_status !== 'Drafts')
  const mrr = data.abos.reduce((s, a) => s + Number(a.mrr), 0)
  const factureNum = new Map(data.factures.map((f) => [f.id, f]))
  const nom = (id: string | null) => (id ? data.nomClient.get(id) ?? '—' : '—')
  const fermerIci = () => fermer(`/finance?onglet=${onglet}`)

  return (
    <>
      <div className="page-head">
        <div><h1>Finance</h1><p>Factures, paiements reçus et abonnements. Le reste dû se calcule à partir des paiements enregistrés.</p></div>
        <div className="actions">
          {onglet === 'abonnements'
            ? <button className="btn primary" onClick={() => go('/finance', { onglet, nouvelle: '1' })}>Nouvel abonnement</button>
            : <button className="btn primary" onClick={() => go('/finance', { onglet: 'factures', nouvelle: '1' })}>Nouvelle facture</button>}
        </div>
      </div>

      <div className="grid kpis">
        <Kpi label="Facturé" value={money(facturable)} hint="Hors brouillons et échecs" />
        <Kpi label="Encaissé" value={money(encaisse)} tone="green" />
        <Kpi label="Reste à encaisser" value={money(reste)} tone={reste > 0 ? 'gold' : undefined} hint={`${retard.length} facture(s) en retard`} />
        <Kpi label="Revenu récurrent mensuel" value={money(mrr)} hint={`${data.abos.filter((a) => a.status === 'Active').length} abonnement(s) actif(s)`} />
      </div>

      <div className="tabs">
        {ONGLETS.map(([k, l]) => <button key={k} className={onglet === k ? 'on' : ''} onClick={() => go('/finance', { onglet: k })}>{l}</button>)}
      </div>

      {onglet === 'factures' && (
        <section className="card">
          {data.factures.length === 0 ? <Empty>Aucune facture.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Facture</th><th>Client</th><th>Statut</th><th>Échéance</th><th className="num">Montant</th><th className="num">Encaissé</th><th className="num">Reste dû</th></tr></thead>
                <tbody>
                  {data.factures.map((f) => {
                    const enRetard = retard.includes(f)
                    return (
                      <tr key={f.id} className="clickable" onClick={() => go('/finance', { onglet, ouvrir: f.id })}>
                        <td><span className="strong">{f.invoice_number}</span></td>
                        <td>{nom(f.client_id)}</td>
                        <td><Pill ton={enRetard ? 'late' : FACTURE_TON[f.payment_status]}>{enRetard && f.payment_status !== 'Overdue' ? 'En retard' : FACTURE_LIBELLE[f.payment_status]}</Pill></td>
                        <td className={enRetard ? 'red' : ''}>{date(f.due_date)}</td>
                        <td className="num">{money(f.amount)}</td>
                        <td className="num green">{Number(f.encaisse) ? money(f.encaisse) : '—'}</td>
                        <td className={`num ${Number(f.reste_du) > 0 ? 'strong' : 'muted'}`}>{money(Math.max(0, Number(f.reste_du)))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {onglet === 'paiements' && (
        <section className="card">
          {data.paiements.length === 0 ? <Empty>Aucun paiement enregistré. Un paiement s’ajoute depuis la fiche d’une facture.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Facture</th><th>Client</th><th>Méthode</th><th>Référence</th><th className="num">Montant</th></tr></thead>
                <tbody>
                  {data.paiements.map((p) => {
                    const f = factureNum.get(p.invoice_id)
                    return (
                      <tr key={p.id} className="clickable" onClick={() => go('/finance', { onglet: 'factures', ouvrir: p.invoice_id })}>
                        <td>{date(p.date_paiement)}</td>
                        <td><span className="strong">{f?.invoice_number ?? '—'}</span></td>
                        <td>{nom(f?.client_id ?? null)}</td>
                        <td>{p.methode ?? '—'}</td>
                        <td className="muted">{p.reference ?? '—'}</td>
                        <td className="num green">{money(p.montant)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {onglet === 'abonnements' && (
        <section className="card">
          {data.abos.length === 0 ? <Empty>Aucun abonnement.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Abonnement</th><th>Client</th><th>Formule</th><th>Statut</th><th>Renouvellement</th><th className="num">Montant</th><th className="num">MRR</th></tr></thead>
                <tbody>
                  {data.abos.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => go('/finance', { onglet, ouvrir: a.id })}>
                      <td><span className="strong">{a.subscription_code}</span></td>
                      <td>{nom(a.client_id)}</td>
                      <td>{PLAN_LIBELLE[a.plan_type] ?? a.plan_type}<div className="muted" style={{ fontSize: 12 }}>{CYCLE_LIBELLE[a.billing_cycle]}</div></td>
                      <td><Pill ton={ABO_TON[a.status]}>{ABO_LIBELLE[a.status]}</Pill></td>
                      <td className={a.status === 'Active' && a.next_renewal_date && a.next_renewal_date < auj ? 'red' : ''}>{date(a.next_renewal_date)}</td>
                      <td className="num">{money(a.amount)}</td>
                      <td className="num">{money(a.mrr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {onglet !== 'abonnements' && (ouvrir || nouvelle) && (
        <FacturePanel id={ouvrir} clientInitial={clientParam} clients={data.clients} paiements={data.paiements.filter((p) => p.invoice_id === ouvrir)}
          onClose={fermerIci} onSaved={reload} />
      )}
      {onglet === 'abonnements' && (ouvrir || nouvelle) && (
        <AboPanel abo={ouvrir ? data.abos.find((a) => a.id === ouvrir) ?? null : null} clientInitial={clientParam} clients={data.clients}
          onClose={fermerIci} onSaved={reload} />
      )}
    </>
  )
}

/* ---------- Facture ---------- */
type FactureForm = {
  client_id: string | null; amount: number | null; payment_status: string; proposal_type: string | null
  date_issued: string | null; due_date: string | null; invoice_file_url: string | null; notes: string | null
}

function FacturePanel({ id, clientInitial, clients, paiements, onClose, onSaved }: {
  id: string | null; clientInitial: string | null; clients: ClientRef[]; paiements: Paiement[]; onClose: () => void; onSaved: () => void
}) {
  const toast = useToast()
  const { data, reload } = useData(async () => (id ? q<Facture>(db.from('v_invoices').select('*').eq('id', id).single()) : null), [id])
  const [f, setF] = useState<FactureForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [pay, setPay] = useState({ montant: '', date_paiement: new Date().toISOString().slice(0, 10), methode: 'Virement bancaire', reference: '' })

  useEffect(() => {
    if (id && !data) return
    const x = data
    setF({
      client_id: x?.client_id ?? clientInitial, amount: x?.amount ?? null, payment_status: x?.payment_status ?? 'Drafts',
      proposal_type: x?.proposal_type ?? null, date_issued: x?.date_issued ?? null, due_date: x?.due_date ?? null,
      invoice_file_url: x?.invoice_file_url ?? null, notes: x?.notes ?? null,
    })
    if (x) setPay((p) => ({ ...p, montant: Number(x.reste_du) > 0 ? String(x.reste_du) : '' }))
  }, [data, id, clientInitial])

  if (!f || (id && !data)) return <Panel title="Facture" onClose={onClose}><Loading /></Panel>
  const set = <K extends keyof FactureForm>(k: K, v: FactureForm[K]) => setF({ ...f, [k]: v })

  const enregistrer = async (statut?: string) => {
    if (!f.client_id) return toast('Choisissez un client.', true)
    if (!f.amount || f.amount <= 0) return toast('Indiquez un montant.', true)
    setBusy(true)
    const corps = { ...f, payment_status: statut ?? f.payment_status }
    if (statut === 'Pending' && !corps.date_issued) corps.date_issued = new Date().toISOString()
    if (statut === 'Pending' && !corps.due_date) corps.due_date = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)
    const res = id
      ? await db.from('invoices').update(corps).eq('id', id).select('id').single()
      : await db.from('invoices').insert(corps).select('id').single()
    setBusy(false)
    if (res.error) return toast(res.error.message, true)
    toast(statut === 'Pending' ? 'Facture émise' : id ? 'Enregistré' : 'Facture créée')
    onSaved()
    if (!id) go('/finance', { onglet: 'factures', ouvrir: res.data.id })
    else reload()
  }

  const encaisser = async () => {
    if (!id || !data) return
    const montant = Number(pay.montant)
    if (!(montant > 0)) return toast('Montant du paiement invalide.', true)
    setBusy(true)
    const { error } = await db.from('payments').insert({ invoice_id: id, montant, date_paiement: pay.date_paiement, methode: pay.methode, reference: pay.reference || null })
    if (!error && montant >= Number(data.reste_du) && data.payment_status !== 'Paid') {
      await db.from('invoices').update({ payment_status: 'Paid' }).eq('id', id)
    }
    setBusy(false)
    if (error) return toast(error.message, true)
    toast('Paiement enregistré')
    setPay({ ...pay, montant: '', reference: '' })
    reload(); onSaved()
  }

  const supprimerPaiement = async (p: Paiement) => {
    if (!window.confirm(`Supprimer le paiement de ${money(p.montant)} du ${date(p.date_paiement)} ?`)) return
    const { error } = await db.from('payments').delete().eq('id', p.id)
    if (error) return toast(error.message, true)
    if (data?.payment_status === 'Paid') await db.from('invoices').update({ payment_status: 'Pending' }).eq('id', p.invoice_id)
    toast('Paiement supprimé'); reload(); onSaved()
  }

  return (
    <Panel
      title={data?.invoice_number ?? 'Nouvelle facture'}
      subtitle={data ? <><Pill ton={FACTURE_TON[data.payment_status]}>{FACTURE_LIBELLE[data.payment_status]}</Pill>{data.project_id && <> · <a className="gold" href={`#/projets?ouvrir=${data.project_id}`}>projet lié</a></>}</> : 'Créée en brouillon. Le numéro définitif est attribué à l’émission.'}
      onClose={onClose}
      footer={<>
        {(!data || data.payment_status === 'Drafts') && <button className="btn" disabled={busy} onClick={() => enregistrer('Pending')}>Émettre</button>}
        <button className="btn primary" disabled={busy} onClick={() => enregistrer()}>Enregistrer</button>
      </>}
    >
      <section>
        <h3 className="section-title">Facture</h3>
        <div className="form-grid">
          <Field label="Client">
            <select className="input" value={f.client_id ?? ''} onChange={(e) => set('client_id', e.target.value || null)} disabled={!!data}>
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Montant (USD)"><input className="input" type="number" min={0} step="0.01" value={f.amount ?? ''} onChange={(e) => set('amount', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Statut"><Select value={f.payment_status} options={FACTURE_STATUTS} labels={FACTURE_LIBELLE} allowEmpty={false} onChange={(v) => set('payment_status', v ?? 'Drafts')} /></Field>
          <Field label="Palier"><Select value={f.proposal_type} options={PALIERS} onChange={(v) => set('proposal_type', v)} /></Field>
          <Field label="Date d’émission"><input className="input" type="date" value={toInputDate(f.date_issued)} onChange={(e) => set('date_issued', e.target.value || null)} /></Field>
          <Field label="Échéance"><input className="input" type="date" value={toInputDate(f.due_date)} onChange={(e) => set('due_date', e.target.value || null)} /></Field>
          <Field label="Fichier de la facture (lien)"><input className="input" value={f.invoice_file_url ?? ''} onChange={(e) => set('invoice_file_url', e.target.value || null)} /></Field>
        </div>
        <Field label="Notes"><textarea className="input" value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} /></Field>
      </section>

      {data && (
        <section>
          <h3 className="section-title">Encaissement</h3>
          <div className="totals card card-pad">
            <div><span>Montant facturable</span><span>{money(data.montant_facturable)}</span></div>
            <div><span>Encaissé</span><span className="green">{money(data.encaisse)}</span></div>
            <div className="grand"><span>Reste dû</span><span>{money(Math.max(0, Number(data.reste_du)))}</span></div>
          </div>

          {paiements.length > 0 && (
            <div className="list" style={{ marginTop: 12 }}>
              {paiements.map((p) => (
                <div key={p.id} className="list-row">
                  <div><div className="t">{money(p.montant)}</div><div className="s">{date(p.date_paiement)} · {p.methode ?? '—'}{p.reference ? ` · ${p.reference}` : ''}</div></div>
                  <button className="btn ghost sm" onClick={() => supprimerPaiement(p)}>Supprimer</button>
                </div>
              ))}
            </div>
          )}

          {data.payment_status !== 'Drafts' && Number(data.reste_du) > 0 && (
            <div className="card card-pad" style={{ marginTop: 12 }}>
              <div className="form-grid">
                <Field label="Montant reçu"><input className="input" type="number" min={0} step="0.01" value={pay.montant} onChange={(e) => setPay({ ...pay, montant: e.target.value })} /></Field>
                <Field label="Date"><input className="input" type="date" value={pay.date_paiement} onChange={(e) => setPay({ ...pay, date_paiement: e.target.value })} /></Field>
                <Field label="Méthode"><Select value={pay.methode} options={METHODES} allowEmpty={false} onChange={(v) => setPay({ ...pay, methode: v ?? 'Autre' })} /></Field>
                <Field label="Référence"><input className="input" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
              </div>
              <button className="btn primary" style={{ marginTop: 12 }} disabled={busy} onClick={encaisser}>Enregistrer le paiement</button>
            </div>
          )}
          {data.payment_status === 'Drafts' && <div className="notice" style={{ marginTop: 12 }}>Émettez la facture pour pouvoir y rattacher un paiement.</div>}
        </section>
      )}
    </Panel>
  )
}

/* ---------- Abonnement ---------- */
type AboForm = { client_id: string | null; plan_type: string | null; billing_cycle: string; status: string; amount: number | null; start_date: string | null; next_renewal_date: string | null }

function prochaineEcheance(debut: string, cycle: string) {
  const d = new Date(debut + 'T00:00:00')
  d.setMonth(d.getMonth() + (cycle === 'Annual' ? 12 : cycle === 'Quarterly' ? 3 : 1))
  return d.toISOString().slice(0, 10)
}

function AboPanel({ abo, clientInitial, clients, onClose, onSaved }: {
  abo: Abo | null; clientInitial: string | null; clients: ClientRef[]; onClose: () => void; onSaved: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState<AboForm>(() => ({
    client_id: abo?.client_id ?? clientInitial, plan_type: abo?.plan_type ?? null, billing_cycle: abo?.billing_cycle ?? 'Monthly',
    status: abo?.status ?? 'Active', amount: abo?.amount ?? null, start_date: abo?.start_date ?? new Date().toISOString().slice(0, 10),
    next_renewal_date: abo?.next_renewal_date ?? null,
  }))
  const set = <K extends keyof AboForm>(k: K, v: AboForm[K]) => setF({ ...f, [k]: v })

  const enregistrer = async () => {
    if (!f.client_id || !f.plan_type) return toast('Client et formule sont requis.', true)
    if (!f.amount || f.amount <= 0) return toast('Indiquez un montant.', true)
    const corps = { ...f, next_renewal_date: f.next_renewal_date ?? (f.start_date ? prochaineEcheance(f.start_date, f.billing_cycle) : null) }
    setBusy(true)
    const res = abo ? await db.from('subscriptions').update(corps).eq('id', abo.id) : await db.from('subscriptions').insert(corps)
    setBusy(false)
    if (res.error) return toast(res.error.message, true)
    toast(abo ? 'Enregistré' : 'Abonnement créé'); onSaved(); onClose()
  }

  const facturerEcheance = async () => {
    if (!abo) return
    const { data, error } = await db.from('invoices').insert({
      client_id: abo.client_id, subscription_id: abo.id, amount: abo.amount, payment_status: 'Drafts',
      notes: `${PLAN_LIBELLE[abo.plan_type] ?? abo.plan_type} · échéance du ${date(abo.next_renewal_date)}`,
    }).select('id').single()
    if (error) return toast(error.message, true)
    if (abo.next_renewal_date) await db.from('subscriptions').update({ next_renewal_date: prochaineEcheance(abo.next_renewal_date, abo.billing_cycle) }).eq('id', abo.id)
    toast('Facture brouillon créée, prochaine échéance avancée'); onSaved()
    go('/finance', { onglet: 'factures', ouvrir: data.id })
  }

  return (
    <Panel
      title={abo?.subscription_code ?? 'Nouvel abonnement'}
      subtitle={abo ? <>MRR {money(abo.mrr)}</> : 'Maintenance, évolution ou accompagnement récurrent.'}
      onClose={onClose}
      footer={<>
        {abo && abo.status === 'Active' && <button className="btn" onClick={facturerEcheance}>Facturer l’échéance</button>}
        <button className="btn primary" disabled={busy} onClick={enregistrer}>Enregistrer</button>
      </>}
    >
      <section>
        <div className="form-grid">
          <Field label="Client">
            <select className="input" value={f.client_id ?? ''} onChange={(e) => set('client_id', e.target.value || null)} disabled={!!abo}>
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Formule"><Select value={f.plan_type} options={PLANS} labels={PLAN_LIBELLE} onChange={(v) => set('plan_type', v)} /></Field>
          <Field label="Cycle"><Select value={f.billing_cycle} options={CYCLES} labels={CYCLE_LIBELLE} allowEmpty={false} onChange={(v) => set('billing_cycle', v ?? 'Monthly')} /></Field>
          <Field label="Statut"><Select value={f.status} options={ABO_STATUTS} labels={ABO_LIBELLE} allowEmpty={false} onChange={(v) => set('status', v ?? 'Active')} /></Field>
          <Field label="Montant par cycle (USD)"><input className="input" type="number" min={0} step="0.01" value={f.amount ?? ''} onChange={(e) => set('amount', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Début"><input className="input" type="date" value={toInputDate(f.start_date)} onChange={(e) => set('start_date', e.target.value || null)} /></Field>
          <Field label="Prochain renouvellement"><input className="input" type="date" value={toInputDate(f.next_renewal_date)} onChange={(e) => set('next_renewal_date', e.target.value || null)} /></Field>
        </div>
        {!f.next_renewal_date && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Laissé vide, le renouvellement est calculé depuis la date de début et le cycle.</p>}
      </section>
    </Panel>
  )
}
