import { ProductList } from '@/components/products/ProductList'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function ProductsPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Produtos' }]} />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">Produtos</h1>
          <p className="text-secondary mt-1">Todos os produtos cadastrados</p>
        </div>
      </div>
      <ProductList showCreateButton />
    </div>
  )
}
