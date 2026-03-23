import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { InstructionContent, ErrorContent, ExportData } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServerClient()

  // Get product
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!product) {
    return Response.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  // Get all modules with their knowledge items
  const { data: modules } = await supabase
    .from('modules')
    .select('*')
    .eq('product_id', product.id)
    .order('created_at', { ascending: true })

  const { data: items } = await supabase
    .from('knowledge_items')
    .select('*, modules!inner(product_id, name)')
    .eq('modules.product_id', product.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  // Build clean export structure
  const exportData: ExportData = {
    produto: product.name,
    exportado_em: new Date().toISOString(),
    instrucoes: [],
    erros: [],
  }

  for (const item of items || []) {
    const moduleName = (item as Record<string, unknown> & { modules: { name: string } }).modules?.name || ''

    if (item.type === 'instruction') {
      const content = item.content as InstructionContent
      exportData.instrucoes.push({
        modulo: moduleName,
        titulo: item.title,
        passos: content.steps.map((s) => ({
          passo: s.passo,
          acao: s.acao,
          orientacao: s.orientacao,
          atalho: s.atalho,
        })),
      })
    } else {
      const content = item.content as ErrorContent
      exportData.erros.push({
        modulo: moduleName,
        titulo: item.title,
        codigo: content.error_code,
        descricao: content.description,
        causa: content.cause,
        solucao: content.solution,
        orientacao: content.orientation,
      })
    }
  }

  return Response.json(exportData)
}
