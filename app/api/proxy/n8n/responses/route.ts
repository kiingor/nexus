// Re-export the responses handler for when n8n uses base URL without /v1
// (OpenAI SDK appends /responses directly to the base URL)
export { POST } from '../v1/responses/route'
