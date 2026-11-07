import { db, q } from '../lib/supabase'
import { date, money, since } from '../lib/format'
import { go } from '../lib/route'
import { FACTURE_LIBELLE, FACTURE_TON, LEAD_STATUT_LIBELLE, LEAD_STATUT_TON } from '../lib/referentiel'
import { Bar, Empty, Kpi, Loading, Pill, useData } from '../components/ui'

type Facture = { id: string; invoice_number: string; client_id: string; montant_facturable: number; encaisse: number; reste_du: number; due_date: string | null; payment_status: string }
type Lead = { id: string; numero: number; company_name: string | null; contact_name: string | null; status: string; type_entree: string | null; created_at: string }
type Projet = { id: string; project_code: string; delivery_status: string | null; estimated_delivery_date: string | null; avancement_pct: number; done: boolean; signed: boolean }

/** L'écran du lundi matin : ce qui est encaissé, ce qui est attendu, ce qui traîne. */
export function Accueil() {
  const { data } = useData(async () => {
    const [factures, abos, leads, projets, bloquees] = await Promise.all([
      q<Facture[]>(db.from('v_invoices').select('id, invoice_number, client_id, montant_facturable, encaisse, reste_du, due_date, payment_status')),
      q<{ mrr: number }[]>(db.from('v_subscriptions').select('mrr')),
      q<Lead[]>(db.from('leads').select('id, numero, company_name, contact_name, status, type_entree, created_at').is('fiche_maitre_id', null).order('created_at', { ascending: false })),
      q<Projet[]>(db.from('v_projects').select('id, project_code, delivery_status, estimated_delivery_date, avancement_pct, done, signed')),
      q<{ id: string }[]>(db.from('tasks').select('id').eq('statut', 'Bloqué')),
    ])
    return { factures, abos, leads, projets, bloquees }
  })
  if (!data) return <Loading />

  const auj = new Date().toISOString().slice(0, 10)
  const encaisse = data.factures.reduce((s, f) => s + Number(f.encaisse), 0)
  const reste = data.factures.reduce((s, f) => s + Math.max(0, Number(f.reste_du)), 0)
  const mrr = data.abos.reduce((s, a) => s + Number(a.mrr), 0)
  const enRetard = data.factures.filter((f) => Number(f.reste_du) > 0 && f.due_date && f.due_date < auj && f.payment_status !== 'Drafts')
  const aTraiter = data.leads.filter((l) => l.status === 'New' || l.status === 'Business Audit')
  const ouverts = data.projets.filter((p) => !p.done && p.signed)
  const glissent = ouverts.filter((p) => p.estimated_delivery_date && p.estimated_delivery_date.slice(0, 10) < auj)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Où en est l'entreprise</h1>
          <p>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · mis à jour à l'ouverture</p>
        </div>
        <div className="actions">
          <a className="btn" href="#/pipeline?nouveau=1">Nouveau lead</a>
          <a className="btn primary" href="#/finance?onglet=factures&nouvelle=1">Nouvelle facture</a>
        </div>
      </div>

      <div className="grid kpis">
        <Kpi label="Encaissé" value={money(encaisse)} tone="green" hint="Somme des paiements reçus" />
        <Kpi label="Reste à encaisser" value={money(reste)} tone={reste > 0 ? 'gold' : undefined} hint={`${enRetard.length} facture(s) en retard`} />
        <Kpi label="Revenu récurrent mensuel" value={money(mrr)} hint="Abonnements actifs, ramenés au mois" />
        <Kpi label="Leads à traiter" value={aTraiter.length} tone={aTraiter.length ? 'gold' : undefined} hint="Nouveaux et en audit" />
        <Kpi label="Projets en production" value={ouverts.length} hint={`${glissent.length} en retard · ${data.bloquees.length} tâche(s) bloquée(s)`} />
      </div>

      <div className="grid cols-2">
        <section className="card">
          <div className="card-head"><h2>Leads à traiter</h2><a className="muted" href="#/pipeline">Tout le pipeline →</a></div>
          {aTraiter.length === 0 ? <Empty>Aucun lead en attente.</Empty> : (
            <div className="list">
              {aTraiter.slice(0, 7).map((l) => (
                <div key={l.id} className="list-row" onClick={() => go('/pipeline', { ouvrir: l.id })}>
                  <div><div className="t">{l.company_name ?? 'Sans société'}</div><div className="s">{l.contact_name ?? '—'} · {l.type_entree ?? 'saisie manuelle'}</div></div>
                  <div style={{ textAlign: 'right' }}><Pill ton={LEAD_STATUT_TON[l.status]}>{LEAD_STATUT_LIBELLE[l.status]}</Pill><div className="s">{since(l.created_at)}</div></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Factures à relancer</h2><a className="muted" href="#/finance?onglet=factures">Finance →</a></div>
          {enRetard.length === 0 ? <Empty>Aucune facture en retard.</Empty> : (
            <div className="list">
              {enRetard.map((f) => (
                <div key={f.id} className="list-row" onClick={() => go('/finance', { onglet: 'factures', ouvrir: f.id })}>
                  <div><div className="t">{f.invoice_number}</div><div className="s">Échue le {date(f.due_date)}</div></div>
                  <div style={{ textAlign: 'right' }}><div className="red" style={{ fontWeight: 600 }}>{money(f.reste_du)}</div><Pill ton={FACTURE_TON[f.payment_status]}>{FACTURE_LIBELLE[f.payment_status]}</Pill></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Projets en production</h2><a className="muted" href="#/projets">Projets →</a></div>
          {ouverts.length === 0 ? <Empty>Aucun projet signé en cours.</Empty> : (
            <div className="list">
              {ouverts.map((p) => {
                const retard = glissent.includes(p)
                return (
                  <div key={p.id} className="list-row" onClick={() => go('/projets', { ouvrir: p.id })}>
                    <div><div className="t">{p.project_code}</div><div className={`s ${retard ? 'red' : ''}`}>{retard ? 'En retard · ' : ''}livraison {date(p.estimated_delivery_date)}</div></div>
                    <div style={{ width: 120 }}><Bar pct={p.avancement_pct} /></div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
