import { Sidebar } from '@/components/ui/Sidebar'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthGuard } from '@/components/auth/AuthGuard'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <ToastProvider>
        <div className="min-h-screen bg-base">
          <Sidebar />
          <main className="lg:pl-64 min-h-screen">
            <div className="p-6 lg:p-8 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </ToastProvider>
    </AuthGuard>
  )
}
