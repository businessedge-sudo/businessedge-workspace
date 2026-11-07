import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_KEY as string

if (!url || !key) throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_KEY doivent être définies.')

export const db = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })

/** Lève une erreur lisible si Supabase renvoie une erreur, sinon renvoie les données. */
export async function q<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}
