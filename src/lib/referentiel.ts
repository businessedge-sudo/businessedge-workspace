// Référentiel : les valeurs autorisées par la base (contraintes CHECK) et le ton de leur pastille.
// ok = réglé (vert), run = en cours (or), late = problème / retard (rouge), info = neutre informatif.
export type Ton = 'ok' | 'run' | 'late' | 'info' | 'mute'

export const LEAD_STATUTS = ['New', 'Business Audit', 'Potential Client', 'Won', 'Disqualified', 'Retracted Client'] as const
export const LEAD_STATUT_LIBELLE: Record<string, string> = {
  'New': 'Nouveau', 'Business Audit': 'Audit en cours', 'Potential Client': 'En attente',
  'Won': 'Gagné', 'Disqualified': 'Disqualifié', 'Retracted Client': 'Désisté',
}
export const LEAD_STATUT_TON: Record<string, Ton> = {
  'New': 'info', 'Business Audit': 'run', 'Potential Client': 'mute', 'Won': 'ok', 'Disqualified': 'late', 'Retracted Client': 'late',
}
export const SOURCES = ['Website', 'WhatsApp', 'LinkedIn', 'Referral', 'Facebook / Instagram', 'TikTok', 'Other']
export const LANGUES = ['Français', 'English']
export const PERIODES_APPEL = ['A contacter', 'Rappeler la matinée', "Rappeler l'après midi"]
export const TENTATIVES = ['1X', '2X', '3X', '4X (Injoignable)']
export const PHASES_RELANCE = ['Première lancé', 'Deuxième lancé', 'Troisième lancé']

export const DELIVERY = ['VERIFICATION', 'Build & QA', 'Delivery & Training', '30Ds Support & Closure']
export const DELIVERY_LIBELLE: Record<string, string> = {
  'VERIFICATION': 'Vérification', 'Build & QA': 'Build & QA', 'Delivery & Training': 'Livraison & formation', '30Ds Support & Closure': 'Support 30 j',
}
export const PROPOSAL_STATUS = ['Not yet', 'Sent', 'Negotiation']
export const PROPOSAL_LIBELLE: Record<string, string> = { 'Not yet': 'Pas encore', 'Sent': 'Envoyée', 'Negotiation': 'Négociation' }
export const PALIERS = ['Standard', 'Medium', 'Premium'] as const
export const MOTIFS_REMISE = ['Offre de lancement', 'Multi-services (2 et +)', 'Paiement comptant', 'Client existant', 'Diagnostic déduit', 'Commercial (à justifier)']

export const TACHE_STATUTS = ['À faire', 'En cours', 'Bloqué', 'En revue', 'Fait']
export const TACHE_TON: Record<string, Ton> = { 'À faire': 'mute', 'En cours': 'run', 'Bloqué': 'late', 'En revue': 'info', 'Fait': 'ok' }

export const CLIENT_STATUTS = ['Active', 'Training', 'Monthly Maintenance', 'Paused', 'Paused / On Hold', 'Past Client']
export const CLIENT_LIBELLE: Record<string, string> = {
  'Active': 'Actif', 'Training': 'Formation', 'Monthly Maintenance': 'Évolution mensuelle', 'Paused': 'En pause', 'Paused / On Hold': 'En attente', 'Past Client': 'Ancien client',
}
export const CLIENT_TON: Record<string, Ton> = {
  'Active': 'ok', 'Training': 'run', 'Monthly Maintenance': 'ok', 'Paused': 'mute', 'Paused / On Hold': 'mute', 'Past Client': 'mute',
}
export const SECTEURS = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Education', 'Media & Communication', 'Manufacturing', 'Consulting', 'Nonprofit', 'Other']

export const FACTURE_STATUTS = ['Drafts', 'Pending', 'Paid', 'Overdue', 'Failed']
export const FACTURE_LIBELLE: Record<string, string> = { 'Drafts': 'Brouillon', 'Pending': 'Émise', 'Paid': 'Payée', 'Overdue': 'En retard', 'Failed': 'Échouée' }
export const FACTURE_TON: Record<string, Ton> = { 'Drafts': 'mute', 'Pending': 'run', 'Paid': 'ok', 'Overdue': 'late', 'Failed': 'late' }
export const METHODES = ['Virement bancaire', 'Stripe', 'Mobile Money', 'Espèces', 'Chèque', 'Autre']

export const PLANS = ['Essentiel', 'Croissance', 'Partenaire']
export const PLAN_LIBELLE: Record<string, string> = { Essentiel: 'Essentiel', Croissance: 'Croissance', Partenaire: 'Partenaire' }
/** Correspondance formule d'abonnement ↔ colonne de prix du service « Abonnement ». */
export const PLAN_PRIX: Record<string, 'prix_standard' | 'prix_medium' | 'prix_premium'> = { Essentiel: 'prix_standard', Croissance: 'prix_medium', Partenaire: 'prix_premium' }
export const CYCLES = ['Monthly', 'Quarterly', 'Annual']
export const CYCLE_LIBELLE: Record<string, string> = { 'Monthly': 'Mensuel', 'Quarterly': 'Trimestriel', 'Annual': 'Annuel' }
export const ABO_STATUTS = ['Active', 'Paused', 'Churned']
export const ABO_LIBELLE: Record<string, string> = { 'Active': 'Actif', 'Paused': 'En pause', 'Churned': 'Arrêté' }
export const ABO_TON: Record<string, Ton> = { 'Active': 'ok', 'Paused': 'mute', 'Churned': 'late' }

export const PHASES = ['1 · Kickoff', '2 · Build', '3 · QA', '4 · Livraison', '5 · Formation', '6 · Clôture']

export const CATEGORIES = ['diagnostic', 'systeme', 'module', 'abonnement'] as const
export const CATEGORIE_LIBELLE: Record<string, string> = { diagnostic: 'Diagnostic', systeme: 'Produit principal', module: 'Modules', abonnement: 'Abonnement' }
export const CATEGORIE_AIDE: Record<string, string> = {
  diagnostic: 'Porte d’entrée payante, déduite du projet s’il est signé.',
  systeme: 'Le système de pilotage : ce que l’on vend en premier.',
  module: 'S’ajoutent au système. Jamais vendus seuls, sauf exception.',
  abonnement: 'Prix mensuels, après livraison.',
}
export const PLATEFORMES = ['Supabase', 'Airtable']
