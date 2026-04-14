'use client'

import { LearnPanel } from '@/components/learn/LearnPanel'
import { ToastProvider } from '@/components/ui/Toast'

export default function LearnPage() {
  return (
    <ToastProvider>
      <div className="min-h-screen py-8 px-6">
        <LearnPanel />
      </div>
    </ToastProvider>
  )
}
