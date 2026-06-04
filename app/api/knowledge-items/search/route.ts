import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/knowledge-items/search?q=...&limit=10
 *
 * Busca cenários (knowledge_items) por título — usado pelo autocomplete
 * do modal de vinculação. ILIKE simples no `title`, com join pra trazer
 * módulo + produto pra exibição.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit')) || 10), 50)

  const supabase = createServerClient()
  let query = supabase
    .from('knowledge_items')
    .select(
      'id, title, type, module_id, is_active, modules(id, name, products(id, name, slug))'
    )
    .eq('is_active', true)
    .order('title', { ascending: true })
    .limit(limit)

  if (q) {
    const pat = `%${q.replace(/[%_]/g, '\\$&')}%`
    query = query.ilike('title', pat)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data ?? [] })
}
