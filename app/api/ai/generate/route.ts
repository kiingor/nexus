import { NextRequest } from 'next/server'
import { getAnthropicClient } from '@/lib/anthropic'

const INSTRUCTION_SYSTEM_PROMPT = `Você é um assistente especializado em estruturar bases de conhecimento para agentes de IA.
O usuário vai descrever um processo em linguagem natural.
Retorne APENAS um objeto JSON válido, sem markdown, sem explicações, sem texto fora do JSON.
A estrutura deve ser exatamente:
{
  "title": "Título curto e descritivo do processo",
  "type": "instruction",
  "steps": [
    {
      "passo": 1,
      "acao": "Ação objetiva que o usuário deve realizar",
      "orientacao": "Onde na tela encontrar o elemento (deixe null se não se aplicar)",
      "atalho": "Atalho de teclado se houver (deixe null se não houver)"
    }
  ]
}`

const ERROR_SYSTEM_PROMPT = `Você é um assistente especializado em estruturar bases de conhecimento para agentes de IA.
O usuário vai descrever um erro de sistema em linguagem natural.
Retorne APENAS um objeto JSON válido, sem markdown, sem explicações, sem texto fora do JSON.
A estrutura deve ser exatamente:
{
  "title": "Título curto e descritivo do erro",
  "type": "error",
  "error_code": "Código do erro se mencionado, senão null",
  "description": "O que o erro significa para o usuário",
  "cause": "Por que esse erro acontece",
  "solution": "Como resolver passo a passo, em texto corrido",
  "orientation": "Onde o erro aparece na tela (null se não se aplicar)"
}`

export async function POST(request: NextRequest) {
  try {
    const { prompt, type } = await request.json()

    if (!prompt || !type) {
      return Response.json(
        { error: 'Campos "prompt" e "type" são obrigatórios.' },
        { status: 400 }
      )
    }

    const client = getAnthropicClient()

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.3,
      system: type === 'instruction' ? INSTRUCTION_SYSTEM_PROMPT : ERROR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return Response.json({ error: 'Sem resposta da IA' }, { status: 500 })
    }

    const parsed = JSON.parse(textBlock.text)

    return Response.json({
      title: parsed.title,
      content:
        type === 'instruction'
          ? { type: 'instruction', steps: parsed.steps }
          : {
              type: 'error',
              error_code: parsed.error_code,
              description: parsed.description,
              cause: parsed.cause,
              solution: parsed.solution,
              orientation: parsed.orientation,
            },
    })
  } catch (error) {
    console.error('AI generate error:', error)
    return Response.json(
      { error: 'Erro ao gerar conteúdo. Verifique a API key.' },
      { status: 500 }
    )
  }
}
