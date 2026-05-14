// Diagnóstico: lista todos os módulos chamados "Dúvidas Fiscais"
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('='))
    .map(([k, ...v]) => [k.trim(), v.join('=').replace(/^"|"$/g, '').trim()])
)

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const { data: modules } = await supabase
  .from('modules')
  .select('id, product_id, name, type, products(slug, name)')
  .eq('name', 'Dúvidas Fiscais')

console.log('MÓDULOS "Dúvidas Fiscais":', JSON.stringify(modules, null, 2))

for (const m of modules ?? []) {
  const { count } = await supabase
    .from('knowledge_items')
    .select('id', { count: 'exact', head: true })
    .eq('module_id', m.id)
  console.log(`  ${m.products.slug}: ${count} items`)
}
