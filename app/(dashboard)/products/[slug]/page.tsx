import { ModuleList } from '@/components/modules/ModuleList'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Produtos', href: '/products' },
          { label: slug },
        ]}
      />
      <ModuleList productSlug={slug} />
    </div>
  )
}
