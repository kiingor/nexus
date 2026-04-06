import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    if (!supabaseUrl || !supabaseAnonKey) {
      const { createClient } = require('@supabase/supabase-js')
      client = createClient('https://placeholder.supabase.co', 'placeholder-key')
    } else {
      client = createBrowserClient(supabaseUrl, supabaseAnonKey)
    }
  }
  return client as SupabaseClient
}

// For backward compatibility
export const supabase = typeof window !== 'undefined'
  ? getSupabaseClient()
  : (null as unknown as SupabaseClient)
