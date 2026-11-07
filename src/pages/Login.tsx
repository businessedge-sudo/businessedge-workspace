import { useState, type FormEvent } from 'react'
import { db } from '../lib/supabase'

/** Connexion sans mot de passe : un code ou un lien envoyé par email. */
export function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [etape, setEtape] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const envoyer = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErreur(null)
    const { error } = await db.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setErreur(error.message)
    else setEtape('code')
  }

  const verifier = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErreur(null)
    const { error } = await db.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setErreur('Code invalide ou expiré. Redemandez-en un.')
  }

  return (
    <div className="login">
      <div className="card login-card">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">B</div>
          <div><div className="brand-name">Business Edge</div><div className="brand-sub">Workspace</div></div>
        </div>

        {etape === 'email' ? (
          <>
            <h1>Connexion</h1>
            <p>Un code de connexion vous est envoyé par email. Accès réservé à l'équipe.</p>
            <form onSubmit={envoyer}>
              <input className="input" type="email" required autoFocus placeholder="vous@entreprise.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn primary" disabled={busy}>{busy ? 'Envoi…' : 'Recevoir le code'}</button>
            </form>
          </>
        ) : (
          <>
            <h1>Vérifiez vos emails</h1>
            <p>Saisissez le code reçu à <strong>{email}</strong>, ou cliquez sur le lien de l'email.</p>
            <form onSubmit={verifier}>
              <input className="input code-input" inputMode="numeric" autoComplete="one-time-code" required autoFocus
                maxLength={10} placeholder="······" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              <button className="btn primary" disabled={busy || code.length < 6}>{busy ? 'Vérification…' : 'Se connecter'}</button>
              <button type="button" className="btn ghost" onClick={() => { setEtape('email'); setCode('') }}>Changer d'adresse</button>
            </form>
          </>
        )}
        {erreur && <div className="notice warn" style={{ marginTop: 14 }}>{erreur}</div>}
      </div>
    </div>
  )
}
