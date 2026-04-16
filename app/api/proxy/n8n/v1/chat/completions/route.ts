// This route re-exports the n8n proxy handler to provide an OpenAI-compatible
// endpoint at /api/proxy/n8n/v1/chat/completions.
// n8n AI Agent nodes expect the path /v1/chat/completions when a custom base
// URL is provided.

export { POST } from '../../../route'
