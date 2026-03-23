import { NextRequest } from 'next/server'
import { getOpenAIClient } from '@/lib/openai'

const INSTRUCTION_SYSTEM_PROMPT = `Você é um assistente especializado em estruturar bases de conhecimento para agentes de IA.
O usuário vai descrever um processo em linguagem natural.
Retorne APENAS um objeto JSON válido, sem markdown, sem explicações, sem texto fora do JSON.

REGRAS IMPORTANTES:
- NÃO invente informações. Use APENAS o que o usuário descreveu.
- O campo "orientacao" só deve ser preenchido se o usuário mencionou onde o elemento fica na tela. Se não mencionou, use null.
- O campo "atalho" só deve ser preenchido se o usuário mencionou um atalho de teclado. Se não mencionou, use null.
- Não adicione passos que o usuário não descreveu.

A estrutura deve ser exatamente:
{
  "title": "Título curto e descritivo do processo",
  "type": "instruction",
  "keywords": ["Frases que o usuário diria ao buscar este processo"],
  "steps": [
    {
      "passo": 1,
      "acao": "Ação descrita pelo usuário",
      "orientacao": null,
      "atalho": null
    }
  ]
}
Gere entre 5 e 10 palavras-chave que representem formas naturais que um usuário usaria para buscar esse processo.`

const ERROR_SYSTEM_PROMPT = `Você é um assistente especializado em estruturar bases de conhecimento para agentes de IA.
O usuário vai descrever um erro de sistema em linguagem natural.
Retorne APENAS um objeto JSON válido, sem markdown, sem explicações, sem texto fora do JSON.

REGRAS IMPORTANTES:
- NÃO invente informações. Use APENAS o que o usuário descreveu.
- O campo "orientation" só deve ser preenchido se o usuário mencionou onde o erro aparece na tela. Se não mencionou, use null.
- O campo "error_code" só deve ser preenchido se o usuário mencionou um código de erro. Se não mencionou, use null.

A estrutura deve ser exatamente:
{
  "title": "Título curto e descritivo do erro",
  "type": "error",
  "keywords": ["Frases que o usuário diria ao relatar este erro"],
  "error_code": null,
  "description": "O que o erro significa para o usuário",
  "cause": "Por que esse erro acontece",
  "solution": "Como resolver passo a passo, em texto corrido",
  "orientation": null
}
Gere entre 5 e 10 palavras-chave que representem formas naturais que um usuário usaria para relatar esse erro.`

export async function POST(request: NextRequest) {
  try {
    const { prompt, type } = await request.json()

    if (!prompt || !type) {
      return Response.json(
        { error: 'Campos "prompt" e "type" são obrigatórios.' },
        { status: 400 }
      )
    }

    const openai = getOpenAIClient()

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.3,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: type === 'instruction' ? INSTRUCTION_SYSTEM_PROMPT : ERROR_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    })

    const text = response.choices[0]?.message?.content
    if (!text) {
      return Response.json({ error: 'Sem resposta da IA' }, { status: 500 })
    }

    const parsed = JSON.parse(text)

    return Response.json({
      title: parsed.title,
      keywords: parsed.keywords || [],
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
