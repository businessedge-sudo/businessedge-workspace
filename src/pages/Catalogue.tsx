import { useState } from 'react'
import { db, q } from '../lib/supabase'
import { money } from '../lib/format'
import { CATEGORIE_AIDE, CATEGORIE_LIBELLE, CATEGORIES, PHASES } from '../lib/referentiel'
import { Empty, Field, Loading, Pill, Select, useData, useToast } from '../components/ui'

export type Service = {
  id: string; nom: string; nom_commercial_fr: string | null; nom_commercial_en: string | null
  categorie: string; ordre: number; actif: boolean; master_template: boolean; description_fr: string | null
  prix_standard: number; prix_medium: number; prix_premium: number
  perimetre_standard: string | null; perimetre_medium: string | null; perimetre_premium: string | null
}
type Etape = { id: string; service_id: string | null; nom: string; ordre: number | null; phase: string | null; duree_jours: number | null; livrable_attendu: string | null; delegable: boolean }

const PALIERS_COL = [
  { k: 'standard', label: 'Standard', abo: 'Essentiel' },
  { k: 'medium', label: 'Medium', abo: 'Croissance' },
  { k: 'premium', label: 'Premium', abo: 'Partenaire' },
] as const

/** Le catalogue est la source des prix, des périmètres et des checklists : tout projet signé en hérite. */
export function Catalogue() {
  const toast = useToast()
  const { data, reload } = useData(async () => {
    const [services, etapes] = await Promise.all([
      q<Service[]>(db.from('services').select('*').order('ordre').order('nom')),
      q<Etape[]>(db.from('etapes_modeles').select('*').order('phase').order('ordre')),
    ])
    return { services, etapes }
  })
  const [choix, setChoix] = useState<string | null>(null)
  if (!data) return <Loading />

  const sel = data.services.find((s) => s.id === choix) ?? data.services.find((s) => s.categorie === 'systeme') ?? data.services[0]
  const etapes = sel ? data.etapes.filter((e) => e.service_id === sel.id) : []
  const jours = etapes.reduce((t, e) => t + Number(e.duree_jours ?? 0), 0)
  const deleg = etapes.filter((e) => e.delegable).length
  const estAbo = sel?.categorie === 'abonnement'

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
  const ajouterModule = async () => {
    const ordre = Math.max(0, ...data.services.map((s) => s.ordre)) + 10
    const { data: s, error } = await db.from('services').insert({ nom: 'Nouveau module', categorie: 'module', ordre, prix_standard: 0, prix_medium: 0, prix_premium: 0, master_template: false }).select('id').single()
    if (error) return toast(error.message, true)
    setChoix(s.id); reload()
  }

  // Champ texte enregistré en quittant le champ, seulement s'il a changé.
  const texte = (k: keyof Service, label: string, multi = false) => {
    const v = (sel[k] as string | null) ?? ''
    const save = (x: string) => x !== v && majService({ [k]: x || null } as Partial<Service>)
    return (
      <Field label={label}>
        {multi
          ? <textarea className="input" rows={3} defaultValue={v} onBlur={(e) => save(e.target.value)} />
          : <input className="input" defaultValue={v} onBlur={(e) => save(e.target.value)} />}
      </Field>
    )
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Catalogue</h1><p>Un diagnostic, un produit principal, des modules et un abonnement. Chaque palier est un périmètre, pas un niveau de qualité.</p></div>
        <button className="btn" onClick={ajouterModule}>Ajouter un module</button>
      </div>

      <div className="catalogue">
        <section className="card">
          {CATEGORIES.map((cat) => {
            const items = data.services.filter((s) => s.categorie === cat)
            if (!items.length) return null
            return (
              <div key={cat} className="cat-group">
                <div className="cat-head"><span>{CATEGORIE_LIBELLE[cat]}</span><small>{CATEGORIE_AIDE[cat]}</small></div>
                <div className="list">
                  {items.map((s) => (
                    <div key={s.id} className={`list-row ${sel?.id === s.id ? 'selected' : ''} ${s.actif ? '' : 'inactive'}`} onClick={() => setChoix(s.id)}>
                      <div>
                        <div className="t">{s.nom_commercial_fr ?? s.nom}</div>
                        <div className="s">{s.nom}{!s.master_template && ' · sans template'}{!s.actif && ' · retiré'}</div>
                      </div>
                      <div className="s" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {money(s.prix_standard)}{cat === 'abonnement' ? ' / mois' : ''}
                        {cat !== 'abonnement' && cat !== 'diagnostic' && <><br />à {money(s.prix_premium)}</>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </section>

        {sel ? (
          <div className="grid" style={{ gap: 16 }} key={sel.id}>
            <section className="card card-pad">
              <div className="card-head" style={{ padding: 0, border: 0, marginBottom: 14 }}>
                <h2>{sel.nom_commercial_fr ?? sel.nom}</h2>
                <div className="actions">
                  <Pill ton={sel.categorie === 'systeme' ? 'run' : 'info'}>{CATEGORIE_LIBELLE[sel.categorie]}</Pill>
                  {!sel.master_template && <Pill ton="mute">Sans Master Template</Pill>}
                </div>
              </div>
              <div className="form-grid">
                {texte('nom', 'Nom interne')}
                <Field label="Catégorie">
                  <Select value={sel.categorie} options={[...CATEGORIES]} labels={CATEGORIE_LIBELLE} allowEmpty={false} onChange={(v) => v && v !== sel.categorie && majService({ categorie: v })} />
                </Field>
                {texte('nom_commercial_fr', 'Nom commercial (FR)')}
                {texte('nom_commercial_en', 'Nom commercial (EN)')}
              </div>
              <div style={{ marginTop: 12 }}>{texte('description_fr', 'À quoi ça sert, en une ou deux phrases', true)}</div>
              <div className="chips" style={{ marginTop: 12 }}>
                <label className="check"><input type="checkbox" checked={sel.master_template} onChange={(e) => majService({ master_template: e.target.checked })} /> Livré depuis un Master Template</label>
                <label className="check"><input type="checkbox" checked={sel.actif} onChange={(e) => majService({ actif: e.target.checked })} /> Proposé à la vente</label>
              </div>
            </section>

            <section className="card card-pad">
              <h2 style={{ margin: '0 0 4px' }}>{estAbo ? 'Formules et prix mensuels' : 'Paliers : prix et périmètre'}</h2>
              <p className="muted" style={{ fontSize: 12.5, margin: '0 0 14px' }}>
                {sel.categorie === 'diagnostic' ? 'Prix unique : mettez le même montant sur les trois paliers.' : estAbo ? 'Une formule par colonne. Le montant se reporte sur l’abonnement à sa création.' : 'Repère : Medium ≈ 2 × Standard, Premium ≈ 4 × Standard.'}
              </p>
              <div className="paliers">
                {PALIERS_COL.map((p) => {
                  const prix = `prix_${p.k}` as const
                  const per = `perimetre_${p.k}` as const
                  return (
                    <div key={p.k} className="palier">
                      <div className="palier-head">{estAbo ? p.abo : p.label}</div>
                      <Field label={estAbo ? 'Prix par mois (USD)' : 'Prix (USD)'}>
                        <input className="input" type="number" min={0} step="50" defaultValue={sel[prix]}
                          onBlur={(e) => Number(e.target.value) !== Number(sel[prix]) && majService({ [prix]: Number(e.target.value) } as Partial<Service>)} />
                      </Field>
                      <Field label="Ce qui est inclus">
                        <textarea className="input" rows={6} defaultValue={sel[per] ?? ''}
                          onBlur={(e) => e.target.value !== (sel[per] ?? '') && majService({ [per]: e.target.value || null } as Partial<Service>)} />
                      </Field>
                    </div>
                  )
                })}
              </div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Enregistrement automatique en quittant le champ. Les projets existants recalculent leur prix.</p>
            </section>

            {!estAbo && (
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
            )}
          </div>
        ) : <Empty>Catalogue vide.</Empty>}
      </div>
    </>
  )
}
