import { revealCitizenBills, type BillScope } from '../store/session'
import { session } from '../store/session'
import type { ChatLine } from '../types'
import { inferBillScope, inferConfirm, inferPayChoice, type PayChoice } from './intent'
import { kioskInstructions } from './kiosk-prompt'
import { browserChat, browserTts, mintRealtimeCredentials } from './openai-browser'
import { realtimeToolDefs } from './tools'

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

function parsePayChoice(value: unknown): PayChoice {
  if (value === 'duitnow' || value === 'card' || value === 'choose') {
    return value
  }
  return 'choose'
}

function applyTool(
  name: string,
  scope: BillScope,
  hooks: VoiceHooks,
  method: PayChoice = 'choose',
): void {
  if (name === 'show_bills') {
    revealCitizenBills('voice', scope)
    hooks.onShowBills(scope)
    return
  }
  if (name === 'start_payment' || name === 'choose_payment') {
    if (!session.bills.length) {
      revealCitizenBills('voice', scope)
    }
    hooks.onReadyToPay(method)
    return
  }
  if (name === 'confirm_payment') {
    if (hooks.canConfirmPayment()) {
      hooks.onConfirmPayment()
    }
    return
  }
  if (name === 'cancel_payment') {
    hooks.onCancelPayment()
  }
}

function parseToolArgs(raw: unknown): { scope: BillScope; method: PayChoice } {
  if (typeof raw === 'object' && raw) {
    const parsed = raw as { kind?: unknown; method?: unknown }
    return { scope: parseScope(parsed.kind), method: parsePayChoice(parsed.method) }
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parseToolArgs(JSON.parse(raw) as { kind?: unknown; method?: unknown })
    } catch {
      return { scope: 'all', method: 'choose' }
    }
  }
  return { scope: 'all', method: 'choose' }
}

function toolCallsFrom(event: Record<string, unknown>): Array<{
  name: string
  scope: BillScope
  method: PayChoice
  callId: string
}> {
  const calls: Array<{ name: string; scope: BillScope; method: PayChoice; callId: string }> = []
  const consider = (name?: string, args?: unknown, callId?: string) => {
    if (
      name !== 'show_bills' &&
      name !== 'start_payment' &&
      name !== 'choose_payment' &&
      name !== 'confirm_payment' &&
      name !== 'cancel_payment'
    ) {
      return
    }
    const parsed = parseToolArgs(args)
    calls.push({
      name,
      scope: parsed.scope,
      method: parsed.method,
      callId: callId ?? `${name}:${JSON.stringify(args ?? '')}`,
    })
  }

  consider(
    event.name as string | undefined,
    event.arguments,
    typeof event.call_id === 'string' ? event.call_id : undefined,
  )
  const item = event.item as
    | { type?: string; name?: string; arguments?: unknown; call_id?: string }
    | undefined
  if (item?.type === 'function_call' || item?.name) {
    consider(item.name, item.arguments, item.call_id)
  }
  const output = (
    event.response as
      | {
          output?: Array<{
            type?: string
            name?: string
            arguments?: unknown
            call_id?: string
          }>
        }
      | undefined
  )?.output
  if (Array.isArray(output)) {
    for (const part of output) {
      if (part.type === 'function_call' || part.name) {
        consider(part.name, part.arguments, part.call_id)
      }
    }
  }
  return calls
}

export type CaptionFrom = 'bot' | 'user'

type VoiceHooks = {
  onPhase: (phase: AgentPhase) => void
  onCaption: (line: ChatLine | null, interim?: string, from?: CaptionFrom) => void
  onReadyToPay: (method: PayChoice) => void
  canConfirmPayment: () => boolean
  onConfirmPayment: () => void
  onCancelPayment: () => void
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
  const pendingToolArgs = new Map<string, { name?: string; args: string }>()
  const appliedToolKeys = new Set<string>()
  const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []

  function emit(line: ChatLine | null, live: string, from: CaptionFrom): void {
    hooks.onCaption(line, live, from)
  }

  function applySpokenIntent(spoken: string): void {
    if (!spoken.trim()) {
      return
    }
    const confirm = inferConfirm(spoken)
    if (confirm === false) {
      hooks.onCancelPayment()
      return
    }
    const scope = inferBillScope(spoken)
    const pay = inferPayChoice(spoken)
    if (scope) {
      applyTool('show_bills', scope, hooks)
    }
    if (pay) {
      applyTool('start_payment', scope ?? 'all', hooks, pay)
      return
    }
    if (confirm === true && hooks.canConfirmPayment()) {
      hooks.onConfirmPayment()
    }
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
      applySpokenIntent(spoken)
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
    const { token: ephemeral, model } = await mintRealtimeCredentials(session.lang)

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
            type: 'realtime',
            instructions: kioskInstructions(session.lang),
            tools: realtimeToolDefs(),
            tool_choice: 'auto',
            input_audio_transcription: { model: 'gpt-4o-mini-transcribe' },
            turn_detection: { type: 'server_vad' },
            audio: {
              input: { turn_detection: { type: 'server_vad' } },
              output: { voice: 'alloy' },
            },
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
      emit(null, liveUser, 'user')
      applySpokenIntent(liveUser)
      if (type.includes('completed') || type.endsWith('.done')) {
        finishUser()
      }
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

    if (type === 'response.function_call_arguments.delta') {
      const callId = String(event.call_id ?? '')
      if (!callId) {
        return
      }
      const entry = pendingToolArgs.get(callId) ?? { args: '' }
      if (typeof event.name === 'string') {
        entry.name = event.name
      }
      if (typeof event.delta === 'string') {
        entry.args += event.delta
      }
      pendingToolArgs.set(callId, entry)
      return
    }

    if (
      type === 'response.function_call_arguments.done' ||
      type === 'response.output_item.done' ||
      type === 'response.done'
    ) {
      const calls = toolCallsFrom(event)
      if (!calls.length) {
        return
      }
      let sentToolReply = false
      for (const call of calls) {
        if (appliedToolKeys.has(call.callId)) {
          continue
        }
        appliedToolKeys.add(call.callId)
        applyTool(call.name, call.scope, hooks, call.method)
        if (call.callId.startsWith('call_')) {
          pendingToolArgs.delete(call.callId)
          channel?.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: call.callId,
                output: JSON.stringify({
                  ok: true,
                  note: 'Stay on the call. Ask for confirmation before showing QR or the card terminal.',
                }),
              },
            }),
          )
          sentToolReply = true
        }
      }
      const item = event.item as { call_id?: string } | undefined
      const fallbackCallId =
        (typeof event.call_id === 'string' && event.call_id) || item?.call_id || ''
      if (!sentToolReply && fallbackCallId) {
        pendingToolArgs.delete(fallbackCallId)
        channel?.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: fallbackCallId,
              output: JSON.stringify({
                ok: true,
                note: 'Stay on the call. Ask for confirmation before showing QR or the card terminal.',
              }),
            },
          }),
        )
        sentToolReply = true
      }
      if (sentToolReply) {
        channel?.send(JSON.stringify({ type: 'response.create' }))
      }
    }
  }

  async function speakWithOpenAi(text: string): Promise<void> {
    speaking = true
    hooks.onPhase('speaking')
    finishBot(text)
    try {
      const blob = await browserTts(text)
      if (blob) {
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
    const data = await browserChat(session.lang, [
      ...chatHistory,
      { role: 'user', content: heard },
    ])
    const text = data.text ?? ''
    chatHistory.push({ role: 'user', content: heard })
    chatHistory.push({ role: 'assistant', content: text })
    applySpokenIntent(heard)
    if (data.tool) {
      applyTool(data.tool, parseScope(data.kind), hooks, parsePayChoice(data.method))
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
        applySpokenIntent(spoken)
        return
      }
      emit(userLine(spoken), '', 'user')
      recognition?.stop()
      applySpokenIntent(spoken)
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
