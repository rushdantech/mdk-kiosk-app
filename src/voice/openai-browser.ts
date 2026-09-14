import { kioskInstructions } from './kiosk-prompt'
import type { BillScope } from '../store/session'
import { chatToolDefs } from './tools'

const REALTIME_MODELS = [
  'gpt-realtime-mini',
  'gpt-realtime',
  'gpt-4o-mini-realtime-preview',
]

export function clientApiKey(): string {
  return String(import.meta.env.VITE_OPENAI_API_KEY ?? '').trim()
}

export async function mintRealtimeCredentials(lang: 'ms' | 'en'): Promise<{
  token: string
  model: string
}> {
  try {
    const sessionRes = await fetch('/api/realtime/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang }),
    })
    if (sessionRes.ok) {
      const sessionJson = (await sessionRes.json()) as {
        client_secret?: { value?: string } | string
        value?: string
        model?: string
      }
      const token =
        typeof sessionJson.client_secret === 'string'
          ? sessionJson.client_secret
          : sessionJson.client_secret?.value ?? sessionJson.value
      if (token) {
        return { token, model: sessionJson.model ?? 'gpt-realtime-mini' }
      }
    }
  } catch {
    /* static host — no Vite proxy */
  }

  const apiKey = clientApiKey()
  if (!apiKey) {
    throw new Error('Missing OpenAI key')
  }

  const instructions = kioskInstructions(lang)
  for (const model of REALTIME_MODELS) {
    try {
      const modern = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: {
            type: 'realtime',
            model,
            instructions,
            audio: {
              input: { transcription: { model: 'gpt-4o-mini-transcribe' } },
              output: { voice: 'alloy' },
            },
          },
        }),
      })
      if (modern.ok) {
        const data = (await modern.json()) as {
          client_secret?: { value?: string } | string
          value?: string
        }
        const token =
          typeof data.client_secret === 'string'
            ? data.client_secret
            : data.client_secret?.value ?? data.value
        if (token) {
          return { token, model }
        }
      }
    } catch {
      /* CORS or network — use the project key on WebRTC */
    }
  }

  return { token: apiKey, model: 'gpt-realtime-mini' }
}

export async function browserChat(
  lang: 'ms' | 'en',
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{ text: string; tool: string | null; kind: BillScope | null; method: string | null }> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang, messages }),
    })
    if (response.ok) {
      return (await response.json()) as {
        text: string
        tool: string | null
        kind: BillScope | null
        method: string | null
      }
    }
  } catch {
    /* static host */
  }

  const apiKey = clientApiKey()
  if (!apiKey) {
    throw new Error('Chat failed')
  }

  const result = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [{ role: 'system', content: kioskInstructions(lang) }, ...messages],
      tools: chatToolDefs(),
    }),
  })
  if (!result.ok) {
    throw new Error('Chat failed')
  }
  const data = (await result.json()) as {
    choices?: Array<{
      message?: {
        content?: string
        tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>
      }
    }>
  }
  const message = data.choices?.[0]?.message
  const toolCall = message?.tool_calls?.[0]?.function
  let kind: BillScope | null = null
  let method: string | null = null
  if (toolCall?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.arguments) as { kind?: BillScope; method?: string }
      kind = parsed.kind ?? null
      method = parsed.method ?? null
    } catch {
      kind = null
    }
  }
  return {
    text:
      message?.content?.trim() ||
      (lang === 'ms'
        ? 'Baik. Saya masih di sini. Cakap sahaja.'
        : 'Okay. I am still here. Just speak.'),
    tool: toolCall?.name ?? null,
    kind,
    method,
  }
}

export async function browserTts(text: string): Promise<Blob | null> {
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (response.ok) {
      return response.blob()
    }
  } catch {
    /* static host */
  }

  const apiKey = clientApiKey()
  if (!apiKey) {
    return null
  }

  for (const model of ['gpt-4o-mini-tts', 'tts-1']) {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, voice: 'alloy', input: text }),
      })
      if (response.ok) {
        return response.blob()
      }
    } catch {
      /* CORS */
    }
  }
  return null
}
