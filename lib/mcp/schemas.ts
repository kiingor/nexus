import { z } from 'zod'

export const InstructionStepSchema = z.object({
  passo: z.number().int().positive(),
  acao: z.string().min(1),
  orientacao: z.string().nullable().optional(),
  atalho: z.string().nullable().optional(),
})

export const InstructionContentSchema = z.object({
  type: z.literal('instruction'),
  steps: z.array(InstructionStepSchema).min(1),
})

export const ErrorContentSchema = z.object({
  type: z.literal('error'),
  error_code: z.string().nullable().optional(),
  description: z.string().min(1),
  cause: z.string().min(1),
  solution: z.string().min(1),
  orientation: z.string().nullable().optional(),
})

export const KnowledgeContentSchema = z.discriminatedUnion('type', [
  InstructionContentSchema,
  ErrorContentSchema,
])

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})
