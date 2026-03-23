import { ProductList } from '@/components/products/ProductList'

export default function DashboardPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">Dashboard</h1>
          <p className="text-secondary mt-1">Gerencie seus produtos e bases de conhecimento</p>
        </div>
      </div>
      <ProductList />
    </div>
  )
}
