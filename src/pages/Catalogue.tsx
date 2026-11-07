import { useState } from 'react'
import { db, q } from '../lib/supabase'
import { money } from '../lib/format'
import { PHASES } from '../lib/referentiel'
import { Empty, Field, Loading, Pill, Select, useData, useToast } from '../components/ui'

type Service = { id: string; nom: string; nom_commercial_fr: string | null; nom_commercial_en: string | null; prix_standard: number; prix_medium: number; prix_premium: number }
type Etape = { id: string; service_id: string | null; nom: string; ordre: number | null; phase: string | null; duree_jours: number | null; livrable_attendu: string | null; delegable: boolean }

/** Le catalogue est la source des prix et des checklists : tout projet signé en hérite. */
export function Catalogue() {
  const toast = useToast()
  const { data, reload } = useData(async () => {
    const [services, etapes] = await Promise.all([
      q<Service[]>(db.from('services').select('*').order('nom')),
      q<Etape[]>(db.from('etapes_modeles').select('*').order('phase').order('ordre')),
    ])
    return { services, etapes }
  })
  const [choix, setChoix] = useState<string | null>(null)
  if (!data) return <Loading />

  const sel = data.services.find((s) => s.id === choix) ?? data.services[0]
  const etapes = sel ? data.etapes.filter((e) => e.service_id === sel.id) : []
  const jours = etapes.reduce((t, e) => t + Number(e.duree_jours ?? 0), 0)
  const deleg = etapes.filter((e) => e.delegable).length

  const majService = async (champs: Partial<Service>) => {
    const { error } = await db.from('services').update(champs).eq('id', sel.id)
    if (error) return toast(error.message, true)
    toast('Catalogue mis à jour'); reload()
  }
  const majEtape = async (e: Etape, champs: Partial<Etape>) => {
    const { error } = await db.from('etapes_modeles').update(champs).eq('id', e.id)
    if (error) return toast(error.message, true)
    reload()
  }
  const ajouterEtape = async () => {
    const ordre = Math.max(0, ...etapes.map((e) => e.ordre ?? 0)) + 1
    const { error } = await db.from('etapes_modeles').insert({ service_id: sel.id, nom: 'Nouvelle étape', ordre, phase: PHASES[1], duree_jours: 1, delegable: false })
    if (error) return toast(error.message, true)
    reload()
  }
  const supprimerEtape = async (e: Etape) => {
    if (!window.confirm(`Supprimer l’étape « ${e.nom} » du modèle ? Les projets déjà signés gardent leur checklist.`)) return
    const { error } = await db.from('etapes_modeles').delete().eq('id', e.id)
    if (error) return toast(error.message, true)
    reload()
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Catalogue</h1><p>Les 8 solutions packagées, leurs trois paliers de prix et la checklist copiée dans chaque projet signé.</p></div>
      </div>

      <div className="grid cols-2" style={{ gridTemplateColumns: 'minmax(260px, 340px) 1fr', alignItems: 'start' }}>
        <section className="card">
          <div className="list">
            {data.services.map((s) => (
              <div key={s.id} className={`list-row ${sel?.id === s.id ? 'on' : ''}`} onClick={() => setChoix(s.id)}
                style={sel?.id === s.id ? { background: 'var(--carbon-700)', boxShadow: 'inset 3px 0 0 var(--brand-500)' } : undefined}>
                <div><div className="t">{s.nom_commercial_fr ?? s.nom}</div><div className="s">{s.nom}</div></div>
                <div className="s" style={{ textAlign: 'right' }}>{money(s.prix_standard)}<br />{data.etapes.filter((e) => e.service_id === s.id).length} étapes</div>
              </div>
            ))}
          </div>
        </section>

        {sel ? (
          <div className="grid" style={{ gap: 16 }}>
            <section className="card card-pad" key={sel.id}>
              <h2 style={{ marginTop: 0, marginBottom: 14 }}>{sel.nom}</h2>
              <div className="form-grid">
                <Field label="Nom commercial (FR)"><input className="input" defaultValue={sel.nom_commercial_fr ?? ''} onBlur={(e) => e.target.value !== (sel.nom_commercial_fr ?? '') && majService({ nom_commercial_fr: e.target.value || null })} /></Field>
                <Field label="Nom commercial (EN)"><input className="input" defaultValue={sel.nom_commercial_en ?? ''} onBlur={(e) => e.target.value !== (sel.nom_commercial_en ?? '') && majService({ nom_commercial_en: e.target.value || null })} /></Field>
                {(['prix_standard', 'prix_medium', 'prix_premium'] as const).map((k) => (
                  <Field key={k} label={`Prix ${k === 'prix_standard' ? 'Standard' : k === 'prix_medium' ? 'Medium' : 'Premium'} (USD)`}>
                    <input className="input" type="number" min={0} step="50" defaultValue={sel[k]}
                      onBlur={(e) => Number(e.target.value) !== Number(sel[k]) && majService({ [k]: Number(e.target.value) } as Partial<Service>)} />
                  </Field>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Enregistrement automatique en quittant le champ. Les projets existants recalculent leur prix catalogue.</p>
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Checklist de production</h2>
                <div className="actions">
                  <Pill ton="info">{jours} j</Pill>
                  <Pill ton="ok">{deleg}/{etapes.length} délégables</Pill>
                  <button className="btn sm" onClick={ajouterEtape}>Ajouter une étape</button>
                </div>
              </div>
              {etapes.length === 0 ? <Empty>Aucune étape pour ce service.</Empty> : (
                <div className="table-wrap">
                  <table className="table-edit" style={{ tableLayout: 'fixed', minWidth: 640 }}>
                    <colgroup><col style={{ width: 66 }} /><col /><col style={{ width: 150 }} /><col style={{ width: 84 }} /><col style={{ width: 96 }} /><col style={{ width: 44 }} /></colgroup>
                    <thead><tr><th>#</th><th>Étape</th><th>Phase</th><th className="num">Jours</th><th>Délégable</th><th /></tr></thead>
                    <tbody>
                      {etapes.map((e) => (
                        <tr key={e.id}>
                          <td><input className="input" style={{ height: 30 }} type="number" defaultValue={e.ordre ?? ''} onBlur={(x) => Number(x.target.value) !== e.ordre && majEtape(e, { ordre: Number(x.target.value) })} /></td>
                          <td>
                            <input className="input" style={{ height: 30 }} defaultValue={e.nom} onBlur={(x) => x.target.value && x.target.value !== e.nom && majEtape(e, { nom: x.target.value })} />
                            <input className="input" style={{ height: 28, marginTop: 4, fontSize: 12 }} placeholder="Livrable attendu" defaultValue={e.livrable_attendu ?? ''} onBlur={(x) => x.target.value !== (e.livrable_attendu ?? '') && majEtape(e, { livrable_attendu: x.target.value || null })} />
                          </td>
                          <td><Select value={e.phase} options={PHASES} onChange={(v) => majEtape(e, { phase: v })} /></td>
                          <td className="num"><input className="input" style={{ height: 30, textAlign: 'right' }} type="number" step="0.5" min={0} defaultValue={e.duree_jours ?? ''} onBlur={(x) => Number(x.target.value) !== Number(e.duree_jours) && majEtape(e, { duree_jours: Number(x.target.value) })} /></td>
                          <td><label className="check"><input type="checkbox" checked={e.delegable} onChange={(x) => majEtape(e, { delegable: x.target.checked })} /> {e.delegable ? 'Oui' : 'Non'}</label></td>
                          <td><button className="btn ghost sm" onClick={() => supprimerEtape(e)} aria-label="Supprimer">✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : <Empty>Catalogue vide.</Empty>}
      </div>
    </>
  )
}
