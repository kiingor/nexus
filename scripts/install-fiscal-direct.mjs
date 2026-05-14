/**
 * Instala "Dúvidas Fiscais" em softshop + softcomshop usando service role
 * (bypassa RLS, não depende de cookie de auth). Gera embeddings via o
 * endpoint /api/embeddings/sync da produção.
 *
 * Rode: node scripts/install-fiscal-direct.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Carrega .env.local
const env = Object.fromEntries(
  readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
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

const fiscalModule = JSON.parse(
  readFileSync(join(__dirname, 'fiscal-module.json'), 'utf8')
)

const PRODUCT_SLUGS = ['softshop', 'softcomshop']
const PROD_URL = 'https://nexus-theta-blush.vercel.app'

async function installInProduct(slug) {
  console.log(`\n=== Instalando em ${slug} ===`)

  // 1) Pega o produto
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('id, name')
    .eq('slug', slug)
    .single()

  if (prodErr || !product) {
    console.error(`❌ Produto "${slug}" não encontrado:`, prodErr?.message)
    return false
  }
  console.log(`✓ Produto: ${product.name} (${product.id})`)

  // 2) Apaga módulos com o mesmo nome (e items + embeddings)
  const { data: existing } = await supabase
    .from('modules')
    .select('id')
    .eq('product_id', product.id)
    .eq('name', fiscalModule.name)

  if (existing?.length) {
    for (const m of existing) {
      const { data: items } = await supabase
        .from('knowledge_items')
        .select('id')
        .eq('module_id', m.id)
      if (items?.length) {
        await supabase
          .from('knowledge_embeddings')
          .delete()
          .in('item_id', items.map((i) => i.id))
        await supabase.from('knowledge_items').delete().eq('module_id', m.id)
      }
      await supabase.from('modules').delete().eq('id', m.id)
    }
    console.log(`✓ Apagados ${existing.length} módulo(s) "${fiscalModule.name}" antigos`)
  }

  // 3) Cria o módulo
  const { data: newMod, error: modErr } = await supabase
    .from('modules')
    .insert({
      product_id: product.id,
      name: fiscalModule.name,
      type: fiscalModule.type,
      description: fiscalModule.description,
      keywords: fiscalModule.keywords || [],
    })
    .select()
    .single()

  if (modErr || !newMod) {
    console.error(`❌ Erro ao criar módulo:`, modErr?.message)
    return false
  }
  console.log(`✓ Módulo criado: ${newMod.id}`)

  // 4) Cria os items
  const createdItemIds = []
  for (const item of fiscalModule.knowledgeItems) {
    const { data: newItem, error: itemErr } = await supabase
      .from('knowledge_items')
      .insert({
        module_id: newMod.id,
        title: item.title,
        type: item.type,
        content: item.content,
        keywords: item.keywords || [],
        is_active: item.is_active ?? true,
      })
      .select()
      .single()

    if (itemErr || !newItem) {
      console.error(`  ❌ Item "${item.title}":`, itemErr?.message)
      continue
    }
    createdItemIds.push(newItem.id)
    console.log(`  ✓ ${item.title}`)
  }

  // 5) Sync embeddings via produção
  console.log(`\n  Gerando embeddings (${createdItemIds.length} items)...`)
  for (const itemId of createdItemIds) {
    try {
      const res = await fetch(`${PROD_URL}/api/embeddings/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, action: 'upsert' }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        console.warn(`  ⚠ embedding ${itemId} (${res.status}): ${txt.slice(0, 100)}`)
      }
    } catch (err) {
      console.warn(`  ⚠ embedding ${itemId}:`, err.message)
    }
  }
  console.log(`  ✓ Embeddings concluídos`)

  return true
}

let ok = 0
for (const slug of PRODUCT_SLUGS) {
  const success = await installInProduct(slug)
  if (success) ok++
}
console.log(`\n=== RESUMO: ${ok}/${PRODUCT_SLUGS.length} produtos OK ===`)
