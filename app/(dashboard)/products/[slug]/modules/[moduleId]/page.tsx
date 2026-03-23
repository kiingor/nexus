import { KnowledgeItemList } from '@/components/knowledge/KnowledgeItemList'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ slug: string; moduleId: string }>
}) {
  const { slug, moduleId } = await params

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Produtos', href: '/products' },
          { label: slug, href: `/products/${slug}` },
          { label: 'Módulo' },
        ]}
      />
      <KnowledgeItemList productSlug={slug} moduleId={moduleId} />
    </div>
  )
}
