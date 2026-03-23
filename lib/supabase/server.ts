import { createClient } from '@supabase/supabase-js'

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !supabaseServiceKey) {
    // During build time, return a client that won't crash
    return createClient('https://placeholder.supabase.co', 'placeholder-key')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}
