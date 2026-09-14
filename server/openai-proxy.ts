import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { kioskInstructions } from './kiosk-prompt.ts'

const REALTIME_MODELS = [
  'gpt-realtime-mini',
  'gpt-realtime',
  'gpt-4o-mini-realtime-preview',
]

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function openaiJson(
  apiKey: string,
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = (await response.json()) as Record<string, unknown>
  return { ok: response.ok, status: response.status, data }
}

export function openaiProxy(apiKey: string): Plugin {
  return {
    name: 'openai-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next()
          return
        }

        if (req.method === 'POST' && req.url.startsWith('/api/realtime/session')) {
          if (!apiKey) {
            json(res, 500, { error: 'Missing OPENAI_API_KEY' })
            return
          }
          const raw = await readBody(req)
          const payload = raw ? (JSON.parse(raw) as { lang?: 'ms' | 'en' }) : {}
          const lang = payload.lang === 'en' ? 'en' : 'ms'
          const instructions = kioskInstructions(lang)

          let lastError: unknown = null
          for (const model of REALTIME_MODELS) {
            const modern = await openaiJson(apiKey, '/realtime/client_secrets', {
              session: {
                type: 'realtime',
                model,
                instructions,
                audio: {
                  input: {
                    transcription: { model: 'gpt-4o-mini-transcribe' },
                  },
                  output: { voice: 'alloy' },
                },
              },
            })
            if (modern.ok) {
              json(res, 200, { ...modern.data, model, path: 'client_secrets' })
              return
            }

            const legacy = await openaiJson(apiKey, '/realtime/sessions', {
              model,
              modalities: ['audio', 'text'],
              instructions,
              voice: 'alloy',
              input_audio_transcription: { model: 'whisper-1' },
              turn_detection: { type: 'server_vad' },
            })
            if (legacy.ok) {
              json(res, 200, { ...legacy.data, model, path: 'sessions' })
              return
            }
            lastError = modern.data.error ?? legacy.data.error ?? modern.data
          }
          json(res, 502, { error: lastError ?? 'Realtime session failed' })
          return
        }

        if (req.method === 'POST' && req.url.startsWith('/api/chat')) {
          if (!apiKey) {
            json(res, 500, { error: 'Missing OPENAI_API_KEY' })
            return
          }
          const payload = JSON.parse(await readBody(req)) as {
            lang?: 'ms' | 'en'
            messages: Array<{ role: 'user' | 'assistant'; content: string }>
          }
          const lang = payload.lang === 'en' ? 'en' : 'ms'
          const result = await openaiJson(apiKey, '/chat/completions', {
            model: 'gpt-4o-mini',
            temperature: 0.4,
            messages: [
              { role: 'system', content: kioskInstructions(lang) },
              ...(payload.messages ?? []),
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'show_bills',
                  description:
                    'Show bills on the kiosk screen only after the resident asks. Use assessment for cukai taksiran, compound for saman or kompaun, all if they ask for every bill.',
                  parameters: {
                    type: 'object',
                    properties: {
                      kind: {
                        type: 'string',
                        enum: ['assessment', 'compound', 'all'],
                      },
                    },
                    required: ['kind'],
                  },
                },
              },
              {
                type: 'function',
                function: {
                  name: 'start_payment',
                  description: 'Open the payment screen so the resident can pay.',
                  parameters: { type: 'object', properties: {} },
                },
              },
            ],
          })
          if (!result.ok) {
            json(res, result.status, result.data)
            return
          }
          const choices = result.data.choices as Array<{
            message?: {
              content?: string
              tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>
            }
          }>
          const message = choices[0]?.message
          const toolCall = message?.tool_calls?.[0]?.function
          let kind: string | null = null
          if (toolCall?.arguments) {
            try {
              kind = String(
                (JSON.parse(toolCall.arguments) as { kind?: string }).kind ?? '',
              ) || null
            } catch {
              kind = null
            }
          }
          json(res, 200, {
            text:
              message?.content?.trim() ||
              (lang === 'ms'
                ? 'Baik. Saya masih di sini. Cakap sahaja.'
                : 'Okay. I am still here. Just speak.'),
            tool: toolCall?.name ?? null,
            kind,
          })
          return
        }

        if (req.method === 'POST' && req.url.startsWith('/api/tts')) {
          if (!apiKey) {
            json(res, 500, { error: 'Missing OPENAI_API_KEY' })
            return
          }
          const payload = JSON.parse(await readBody(req)) as { text?: string }
          const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini-tts',
              voice: 'alloy',
              input: payload.text ?? '',
            }),
          })
          if (!response.ok) {
            const fallback = await fetch('https://api.openai.com/v1/audio/speech', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'tts-1',
                voice: 'alloy',
                input: payload.text ?? '',
              }),
            })
            if (!fallback.ok) {
              json(res, fallback.status, { error: 'TTS failed' })
              return
            }
            res.statusCode = 200
            res.setHeader('Content-Type', fallback.headers.get('content-type') ?? 'audio/mpeg')
            res.end(Buffer.from(await fallback.arrayBuffer()))
            return
          }
          res.statusCode = 200
          res.setHeader('Content-Type', response.headers.get('content-type') ?? 'audio/mpeg')
          res.end(Buffer.from(await response.arrayBuffer()))
          return
        }

        next()
      })
    },
  }
}
