import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    if (!supabaseUrl || !supabaseAnonKey) {
      // Return a dummy client that won't crash during build
      // but will fail gracefully at runtime
      client = createClient('https://placeholder.supabase.co', 'placeholder-key')
    } else {
      client = createClient(supabaseUrl, supabaseAnonKey)
    }
  }
  return client
}

// For backward compatibility
export const supabase = typeof window !== 'undefined'
  ? getSupabaseClient()
  : (null as unknown as SupabaseClient)
