import { loadCitizenBills, type BillScope } from '../store/session'
import { session } from '../store/session'
import type { ChatLine } from '../types'

export type AgentPhase = 'connecting' | 'speaking' | 'listening' | 'thinking'

type RecEvent = {
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: RecEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

type RecCtor = new () => Recognition

export function lineText(line: ChatLine): string {
  return session.lang === 'ms' ? line.ms : line.en
}

function both(text: string): ChatLine {
  return { from: 'bot', ms: text, en: text }
}

function userLine(text: string): ChatLine {
  return { from: 'user', ms: text, en: text }
}

function recognitionCtor(): RecCtor | null {
  const holder = window as Window & {
    SpeechRecognition?: RecCtor
    webkitSpeechRecognition?: RecCtor
  }
  return holder.SpeechRecognition ?? holder.webkitSpeechRecognition ?? null
}

function parseScope(value: unknown): BillScope {
  if (value === 'assessment' || value === 'compound') {
    return value
  }
  return 'all'
}

function applyTool(name: string, scope: BillScope, hooks: VoiceHooks): void {
  if (name === 'show_bills') {
    loadCitizenBills('voice', scope)
    hooks.onShowBills(scope)
    return
  }
  if (name === 'start_payment') {
    loadCitizenBills('voice', scope)
    hooks.onReadyToPay()
  }
}

export type CaptionFrom = 'bot' | 'user'

type VoiceHooks = {
  onPhase: (phase: AgentPhase) => void
  onCaption: (line: ChatLine | null, interim?: string, from?: CaptionFrom) => void
  onReadyToPay: () => void
  onShowBills: (scope: BillScope) => void
  onError: (message: string) => void
}

function eventText(event: Record<string, unknown>, current: string): string {
  if (typeof event.delta === 'string' && event.delta) {
    return current + event.delta
  }
  if (typeof event.transcript === 'string') {
    return event.transcript
  }
  return current
}

function takeCompleteSentences(buffer: string): { done: string[]; rest: string } {
  const done: string[] = []
  let start = 0
  for (let index = 0; index < buffer.length; index += 1) {
    const mark = buffer[index]
    if (mark !== '.' && mark !== '!' && mark !== '?') {
      continue
    }
    const prev = buffer[index - 1]
    const next = buffer[index + 1]
    if (mark === '.' && prev && /\d/.test(prev) && next && /\d/.test(next)) {
      continue
    }
    if (next && next !== ' ' && next !== '\n') {
      continue
    }
    const piece = buffer.slice(start, index + 1).trim()
    if (piece) {
      done.push(piece)
    }
    start = index + 1
  }
  return { done, rest: buffer.slice(start) }
}

function splitSentences(text: string): string[] {
  const { done, rest } = takeCompleteSentences(`${text.trim()} `)
  const leftover = rest.trim()
  return leftover ? [...done, leftover] : done
}

export function createVoiceRuntime(hooks: VoiceHooks): {
  start: () => Promise<void>
  setMuted: (muted: boolean) => void
  stop: () => void
} {
  let stopped = false
  let muted = false
  let peer: RTCPeerConnection | null = null
  let localStream: MediaStream | null = null
  let remoteAudio: HTMLAudioElement | null = null
  let channel: RTCDataChannel | null = null
  let recognition: Recognition | null = null
  let speaking = false
  let liveUser = ''
  let liveBot = ''
  let sawBotDelta = false
  const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []

  function emit(line: ChatLine | null, live: string, from: CaptionFrom): void {
    hooks.onCaption(line, live, from)
  }

  function flushBotSentences(): void {
    const { done, rest } = takeCompleteSentences(liveBot)
    liveBot = rest
    for (const sentence of done) {
      emit(both(sentence), liveBot, 'bot')
    }
    emit(null, liveBot, 'bot')
  }

  function finishBot(full?: string): void {
    if (!sawBotDelta && full) {
      for (const sentence of splitSentences(full)) {
        emit(both(sentence), '', 'bot')
      }
    } else if (liveBot.trim()) {
      emit(both(liveBot.trim()), '', 'bot')
    } else {
      emit(null, '', 'bot')
    }
    liveBot = ''
    sawBotDelta = false
  }

  function finishUser(full?: string): void {
    const spoken = (full ?? liveUser).trim()
    liveUser = ''
    if (spoken) {
      emit(userLine(spoken), '', 'user')
      return
    }
    emit(null, '', 'user')
  }

  function stopHardware(): void {
    stopped = true
    recognition?.abort()
    channel?.close()
    peer?.getSenders().forEach((sender) => sender.track?.stop())
    peer?.close()
    localStream?.getTracks().forEach((track) => track.stop())
    if (remoteAudio) {
      remoteAudio.pause()
      remoteAudio.srcObject = null
    }
    window.speechSynthesis.cancel()
  }

  function setLocalMuted(next: boolean): void {
    muted = next
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !next
    })
    if (next) {
      recognition?.abort()
      window.speechSynthesis.cancel()
    }
  }

  async function startRealtime(): Promise<void> {
    hooks.onPhase('connecting')
    const sessionRes = await fetch('/api/realtime/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: session.lang }),
    })
    const sessionJson = (await sessionRes.json()) as {
      client_secret?: { value?: string } | string
      value?: string
      model?: string
      error?: unknown
    }
    if (!sessionRes.ok) {
      throw new Error('Realtime session unavailable')
    }
    const ephemeral =
      typeof sessionJson.client_secret === 'string'
        ? sessionJson.client_secret
        : sessionJson.client_secret?.value ?? sessionJson.value
    if (!ephemeral) {
      throw new Error('No ephemeral key')
    }

    remoteAudio = new Audio()
    remoteAudio.autoplay = true
    peer = new RTCPeerConnection()
    peer.ontrack = (event) => {
      if (remoteAudio) {
        remoteAudio.srcObject = event.streams[0] ?? null
      }
    }

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    localStream.getTracks().forEach((track) => {
      peer?.addTrack(track, localStream as MediaStream)
    })

    channel = peer.createDataChannel('oai-events')
    channel.addEventListener('message', (event) => {
      handleRealtimeEvent(String(event.data))
    })
    channel.addEventListener('open', () => {
      hooks.onPhase('listening')
      channel?.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            turn_detection: { type: 'server_vad' },
            tools: [
              {
                type: 'function',
                name: 'show_bills',
                description:
                  'Show bills on screen only after the resident asks. Use assessment for cukai taksiran, compound for saman/kompaun, all if they ask for everything.',
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
              {
                type: 'function',
                name: 'start_payment',
                description: 'Open the payment screen.',
                parameters: { type: 'object', properties: {} },
              },
            ],
            tool_choice: 'auto',
          },
        }),
      )
      channel?.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            instructions:
              session.lang === 'ms'
                ? 'Sapa pengguna dengan ringkas dan tanya apa yang mereka mahu semak atau bayar.'
                : 'Greet the resident briefly and ask what they want to check or pay.',
          },
        }),
      )
    })

    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    const model = sessionJson.model ?? 'gpt-realtime-mini'
    const endpoints = [
      'https://api.openai.com/v1/realtime/calls',
      `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
    ]
    let answerSdp = ''
    for (const url of endpoints) {
      const sdpResponse = await fetch(url, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeral}`,
          'Content-Type': 'application/sdp',
        },
      })
      if (sdpResponse.ok) {
        answerSdp = await sdpResponse.text()
        break
      }
    }
    if (!answerSdp) {
      throw new Error('WebRTC handshake failed')
    }
    await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp })
  }

  function handleRealtimeEvent(raw: string): void {
    let event: Record<string, unknown>
    try {
      event = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }
    const type = String(event.type ?? '')

    if (type.includes('input_audio_buffer.speech_started')) {
      liveUser = ''
      hooks.onPhase('listening')
      emit(null, '', 'user')
      return
    }
    if (type.includes('speech_stopped') || type.includes('response.created')) {
      if (type.includes('response.created')) {
        liveBot = ''
        sawBotDelta = false
      }
      hooks.onPhase('thinking')
      return
    }
    if (type.includes('output_audio') || type.includes('response.audio')) {
      hooks.onPhase('speaking')
    }
    if (type.includes('response.done') || type.includes('output_audio.done')) {
      hooks.onPhase('listening')
    }

    if (type.includes('input_audio_transcription')) {
      liveUser = eventText(event, liveUser)
      if (type.includes('completed') || type.endsWith('.done')) {
        finishUser()
        return
      }
      emit(null, liveUser, 'user')
      return
    }

    if (type.includes('output_audio_transcript') || type.includes('audio_transcript')) {
      if (type.includes('delta')) {
        sawBotDelta = true
        liveBot = eventText(event, liveBot)
        flushBotSentences()
        return
      }
      if (type.includes('done')) {
        const full = typeof event.transcript === 'string' ? event.transcript : undefined
        finishBot(full)
      }
      return
    }

    if (type === 'response.function_call_arguments.done' || type === 'response.output_item.done') {
      const item = event.item as { name?: string; arguments?: string } | undefined
      const name = String((event.name as string | undefined) ?? item?.name ?? '')
      let scope: BillScope = 'all'
      const rawArgs = event.arguments ?? item?.arguments
      if (typeof rawArgs === 'string' && rawArgs.trim()) {
        try {
          scope = parseScope((JSON.parse(rawArgs) as { kind?: unknown }).kind)
        } catch {
          scope = 'all'
        }
      }
      if (name === 'show_bills' || name === 'start_payment') {
        applyTool(name, scope, hooks)
        channel?.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: event.call_id ?? (item as { call_id?: string } | undefined)?.call_id,
              output: JSON.stringify({ ok: true }),
            },
          }),
        )
        channel?.send(JSON.stringify({ type: 'response.create' }))
      }
    }
  }

  async function speakWithOpenAi(text: string): Promise<void> {
    speaking = true
    hooks.onPhase('speaking')
    finishBot(text)
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        await new Promise<void>((resolve) => {
          const audio = new Audio(url)
          audio.onended = () => {
            URL.revokeObjectURL(url)
            resolve()
          }
          audio.onerror = () => resolve()
          void audio.play()
        })
        return
      }
    } catch {
      /* browser speech fallback */
    }
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = session.lang === 'ms' ? 'ms-MY' : 'en-GB'
      utterance.rate = 0.92
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    })
  }

  async function askModel(heard: string): Promise<void> {
    hooks.onPhase('thinking')
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lang: session.lang,
        messages: [...chatHistory, { role: 'user', content: heard }],
      }),
    })
    if (!response.ok) {
      throw new Error('Chat failed')
    }
    const data = (await response.json()) as {
      text?: string
      tool?: string | null
      kind?: BillScope | null
    }
    const text = data.text ?? ''
    chatHistory.push({ role: 'user', content: heard })
    chatHistory.push({ role: 'assistant', content: text })
    if (data.tool) {
      applyTool(data.tool, parseScope(data.kind), hooks)
    }
    await speakWithOpenAi(text)
    speaking = false
    hooks.onPhase('listening')
  }

  function listenChat(): void {
    if (stopped || muted || speaking) {
      return
    }
    hooks.onPhase('listening')
    const Ctor = recognitionCtor()
    if (!Ctor) {
      hooks.onError(
        session.lang === 'ms'
          ? 'Pelayar ini tidak sokong mikrofon suara. Cuba Chrome.'
          : 'This browser cannot listen. Please try Chrome.',
      )
      return
    }
    recognition?.abort()
    recognition = new Ctor()
    recognition.lang = session.lang === 'ms' ? 'ms-MY' : 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      if (speaking || muted || stopped) {
        return
      }
      const last = event.results[event.results.length - 1]
      if (!last) {
        return
      }
      const spoken = last[0].transcript.trim()
      if (!spoken) {
        return
      }
      if (!last.isFinal) {
        emit(null, spoken, 'user')
        return
      }
      emit(userLine(spoken), '', 'user')
      recognition?.stop()
      void askModel(spoken)
        .catch((error: unknown) => {
          hooks.onError(error instanceof Error ? error.message : 'Model error')
        })
        .finally(() => {
          if (!stopped && !muted) {
            listenChat()
          }
        })
    }
    recognition.onend = () => {
      if (!stopped && !muted && !speaking) {
        window.setTimeout(listenChat, 300)
      }
    }
    recognition.onerror = () => undefined
    try {
      recognition.start()
    } catch {
      /* already started */
    }
  }

  async function startChatVoice(): Promise<void> {
    hooks.onPhase('connecting')
    const hello =
      session.lang === 'ms'
        ? 'Assalamualaikum. Saya pembantu MDK. Cakap sahaja, saya dengar.'
        : 'Hello. I am the MDK assistant. Just speak, I am listening.'
    chatHistory.push({ role: 'assistant', content: hello })
    await speakWithOpenAi(hello)
    speaking = false
    listenChat()
  }

  return {
    async start() {
      try {
        await startRealtime()
      } catch {
        try {
          await startChatVoice()
        } catch (error) {
          hooks.onError(
            error instanceof Error
              ? error.message
              : session.lang === 'ms'
                ? 'Tidak dapat sambung ke pembantu.'
                : 'Could not connect to the assistant.',
          )
        }
      }
    },
    setMuted(next) {
      setLocalMuted(next)
      if (!next && !peer) {
        listenChat()
      }
    },
    stop() {
      stopHardware()
    },
  }
}
