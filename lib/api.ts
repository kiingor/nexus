const BASE = ''

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }

  return res.json()
}

export const api = {
  // Products
  getProducts: () => request('/api/products'),
  getProduct: (slug: string) => request(`/api/products/${slug}`),
  createProduct: (data: { name: string; slug: string; description?: string }) =>
    request('/api/products', { method: 'POST', body: JSON.stringify(data) }),

  // Modules
  getModules: (slug: string) => request(`/api/products/${slug}/modules`),

  // Knowledge
  getKnowledge: (slug: string, moduleId?: string) =>
    request(`/api/products/${slug}/knowledge${moduleId ? `?moduleId=${moduleId}` : ''}`),

  // Export
  getExport: (slug: string) => request(`/api/products/${slug}/export`),

  // AI
  generateContent: (data: { prompt: string; type: 'instruction' | 'error' }) =>
    request('/api/ai/generate', { method: 'POST', body: JSON.stringify(data) }),

  chat: (data: { message: string; productSlug: string; moduleId?: string; history?: Array<{ role: string; content: string }> }) =>
    request('/api/ai/chat', { method: 'POST', body: JSON.stringify(data) }),
}
