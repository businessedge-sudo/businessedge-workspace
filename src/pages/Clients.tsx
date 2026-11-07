import { useEffect, useState } from 'react'
import { db, q } from '../lib/supabase'
import { date, money } from '../lib/format'
import { fermer, go } from '../lib/route'
import {
  ABO_LIBELLE, ABO_TON, CLIENT_LIBELLE, CLIENT_STATUTS, CLIENT_TON, DELIVERY_LIBELLE, FACTURE_LIBELLE, FACTURE_TON, PLAN_LIBELLE, SECTEURS,
} from '../lib/referentiel'
import { Empty, Field, Kpi, Loading, Panel, Pill, Select, useData, useToast } from '../components/ui'

type Client = {
  id: string; numero: number; client_code: string; global_status: string | null; industry: string | null; dossier_url: string | null
  created_at: string; contact_name: string | null; email: string | null; phone: string | null
  nb_projets: number; ca_projets: number; total_facture: number; total_encaisse: number; mrr: number
}

export function Clients({ params }: { params: URLSearchParams }) {
  const [recherche, setRecherche] = useState('')
  const { data, reload } = useData(async () => {
    const [clients, leads] = await Promise.all([
      q<Client[]>(db.from('v_clients').select('*').order('numero', { ascending: false })),
      q<{ client_id: string; company_name: string | null }[]>(db.from('leads').select('client_id, company_name').not('client_id', 'is', null).is('fiche_maitre_id', null)),
    ])
    const societes = new Map<string, string>()
    leads.forEach((l) => { if (l.company_name && !societes.has(l.client_id)) societes.set(l.client_id, l.company_name) })
    return { clients, societes }
  })
  const ouvrir = params.get('ouvrir')
  if (!data) return <Loading />

  const t = recherche.trim().toLowerCase()
  const liste = data.clients.filter((c) => !t || [c.client_code, c.contact_name, c.email, data.societes.get(c.id)].some((v) => v?.toLowerCase().includes(t)))
  const actifs = data.clients.filter((c) => c.global_status && c.global_status !== 'Past Client' && !c.global_status.startsWith('Paused'))
  const ca = data.clients.reduce((s, c) => s + Number(c.total_encaisse), 0)
  const mrr = data.clients.reduce((s, c) => s + Number(c.mrr), 0)

  return (
    <>
      <div className="page-head">
        <div><h1>Clients</h1><p>Un client se crée automatiquement quand un lead passe en « Gagné ».</p></div>
        <input className="input search" placeholder="Rechercher un client" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      </div>

      <div className="grid kpis">
        <Kpi label="Clients" value={data.clients.length} hint={`${actifs.length} actif(s)`} />
        <Kpi label="Encaissé, tous clients" value={money(ca)} tone="green" />
        <Kpi label="Revenu récurrent mensuel" value={money(mrr)} />
      </div>

      <section className="card">
        {liste.length === 0 ? <Empty>{data.clients.length ? 'Aucun client ne correspond.' : 'Aucun client pour l’instant. Le premier arrivera avec le premier lead gagné.'}</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th>Contact</th><th>Statut</th><th className="num">Projets</th><th className="num">Facturé</th><th className="num">Encaissé</th><th className="num">MRR</th></tr></thead>
              <tbody>
                {liste.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => go('/clients', { ouvrir: c.id })}>
                    <td><span className="strong">{data.societes.get(c.id) ?? c.client_code}</span><div className="muted" style={{ fontSize: 12 }}>{c.client_code}</div></td>
                    <td>{c.contact_name ?? '—'}<div className="muted" style={{ fontSize: 12 }}>{c.email ?? ''}</div></td>
                    <td>{c.global_status ? <Pill ton={CLIENT_TON[c.global_status]}>{CLIENT_LIBELLE[c.global_status]}</Pill> : <span className="muted">—</span>}</td>
                    <td className="num">{c.nb_projets}</td>
                    <td className="num">{money(c.total_facture)}</td>
                    <td className="num green">{money(c.total_encaisse)}</td>
                    <td className="num">{Number(c.mrr) ? money(c.mrr) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ouvrir && <ClientPanel id={ouvrir} societe={data.societes.get(ouvrir)} onClose={() => fermer('/clients')} onSaved={reload} />}
    </>
  )
}

type ProjetC = { id: string; project_code: string; signed: boolean; done: boolean; delivery_status: string | null; montant_du: number }
type FactureC = { id: string; invoice_number: string; payment_status: string; montant_facturable: number; reste_du: number; due_date: string | null }
type AboC = { id: string; subscription_code: string; plan_type: string; status: string; mrr: number }
type LeadC = { id: string; numero: number; company_name: string | null; status: string; created_at: string }

function ClientPanel({ id, societe, onClose, onSaved }: { id: string; societe?: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const { data } = useData(async () => {
    const [c, projets, factures, abos, leads] = await Promise.all([
      q<Client>(db.from('v_clients').select('*').eq('id', id).single()),
      q<ProjetC[]>(db.from('v_projects').select('id, project_code, signed, done, delivery_status, montant_du').eq('client_id', id).order('created_at', { ascending: false })),
      q<FactureC[]>(db.from('v_invoices').select('id, invoice_number, payment_status, montant_facturable, reste_du, due_date').eq('client_id', id).order('created_at', { ascending: false })),
      q<AboC[]>(db.from('v_subscriptions').select('id, subscription_code, plan_type, status, mrr').eq('client_id', id)),
      q<LeadC[]>(db.from('leads').select('id, numero, company_name, status, created_at').eq('client_id', id).order('created_at')),
    ])
    return { c, projets, factures, abos, leads }
  }, [id])
  const [f, setF] = useState<{ global_status: string | null; industry: string | null; dossier_url: string | null } | null>(null)
  useEffect(() => { if (data) setF({ global_status: data.c.global_status, industry: data.c.industry, dossier_url: data.c.dossier_url }) }, [data])

  if (!data || !f) return <Panel title="Client" onClose={onClose}><Loading /></Panel>
  const c = data.c

  const enregistrer = async () => {
    const { error } = await db.from('clients').update(f).eq('id', id)
    if (error) return toast(error.message, true)
    toast('Enregistré'); onSaved()
  }

  return (
    <Panel
      title={societe ?? c.client_code}
      subtitle={<>{c.client_code} · client depuis le {date(c.created_at)}</>}
      onClose={onClose}
      footer={<>
        <a className="btn" href={`#/finance?onglet=factures&nouvelle=1&client=${id}`}>Nouvelle facture</a>
        <a className="btn" href={`#/finance?onglet=abonnements&nouvelle=1&client=${id}`}>Nouvel abonnement</a>
        <button className="btn primary" onClick={enregistrer}>Enregistrer</button>
      </>}
    >
      <section>
        <h3 className="section-title">Contact</h3>
        <dl className="kv">
          <dt>Nom</dt><dd>{c.contact_name ?? '—'}</dd>
          <dt>E-mail</dt><dd>{c.email ? <a className="gold" href={`mailto:${c.email}`}>{c.email}</a> : '—'}</dd>
          <dt>Téléphone</dt><dd>{c.phone ? <a className="gold" href={`tel:${c.phone}`}>{c.phone}</a> : '—'}</dd>
          <dt>Fiche d’origine</dt><dd>{data.leads.map((l) => <div key={l.id}><a className="gold" href={`#/pipeline?ouvrir=${l.id}`}>Lead n° {l.numero}</a> <span className="muted">· {date(l.created_at)}</span></div>)}</dd>
        </dl>
      </section>

      <section>
        <h3 className="section-title">Compte</h3>
        <div className="form-grid">
          <Field label="Statut"><Select value={f.global_status} options={CLIENT_STATUTS} labels={CLIENT_LIBELLE} onChange={(v) => setF({ ...f, global_status: v })} /></Field>
          <Field label="Secteur"><Select value={f.industry} options={SECTEURS} onChange={(v) => setF({ ...f, industry: v })} /></Field>
          <Field label="Dossier Drive (lien)"><input className="input" value={f.dossier_url ?? ''} onChange={(e) => setF({ ...f, dossier_url: e.target.value || null })} /></Field>
        </div>
        {f.dossier_url && <p style={{ marginTop: 8 }}><a className="gold" href={f.dossier_url} target="_blank" rel="noreferrer">Ouvrir le dossier ↗</a></p>}
        <div className="totals card card-pad" style={{ marginTop: 12 }}>
          <div><span>Chiffre d’affaires projets</span><span>{money(c.ca_projets)}</span></div>
          <div><span>Facturé</span><span>{money(c.total_facture)}</span></div>
          <div><span>Encaissé</span><span className="green">{money(c.total_encaisse)}</span></div>
          <div className="grand"><span>Reste dû</span><span>{money(Math.max(0, Number(c.total_facture) - Number(c.total_encaisse)))}</span></div>
        </div>
      </section>

      <section>
        <h3 className="section-title">Projets</h3>
        {data.projets.length === 0 ? <div className="notice">Aucun projet.</div> : (
          <div className="list">
            {data.projets.map((p) => (
              <div key={p.id} className="list-row" onClick={() => go('/projets', { ouvrir: p.id })}>
                <div><div className="t">{p.project_code}</div><div className="s">{money(p.montant_du)}</div></div>
                {p.done ? <Pill ton="ok">Clôturé</Pill> : p.signed ? <Pill ton="run">{DELIVERY_LIBELLE[p.delivery_status ?? ''] ?? 'Signé'}</Pill> : <Pill ton="info">En vente</Pill>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title">Factures</h3>
        {data.factures.length === 0 ? <div className="notice">Aucune facture.</div> : (
          <div className="list">
            {data.factures.map((x) => (
              <div key={x.id} className="list-row" onClick={() => go('/finance', { onglet: 'factures', ouvrir: x.id })}>
                <div><div className="t">{x.invoice_number}</div><div className="s">{money(x.montant_facturable)}{x.due_date ? ` · échéance ${date(x.due_date)}` : ''}</div></div>
                <Pill ton={FACTURE_TON[x.payment_status]}>{FACTURE_LIBELLE[x.payment_status]}</Pill>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.abos.length > 0 && (
        <section>
          <h3 className="section-title">Abonnements</h3>
          <div className="list">
            {data.abos.map((a) => (
              <div key={a.id} className="list-row" onClick={() => go('/finance', { onglet: 'abonnements', ouvrir: a.id })}>
                <div><div className="t">{PLAN_LIBELLE[a.plan_type] ?? a.plan_type}</div><div className="s">{a.subscription_code} · {money(a.mrr)} / mois</div></div>
                <Pill ton={ABO_TON[a.status]}>{ABO_LIBELLE[a.status]}</Pill>
              </div>
            ))}
          </div>
        </section>
      )}
    </Panel>
  )
}
