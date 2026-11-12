import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export const speechSupported = Boolean(SpeechRecognition)

/**
 * Records the microphone, transcribes live with the browser's speech engine,
 * and exposes an AnalyserNode so the UI can draw a waveform.
 *
 * Chrome ends recognition after a pause, so we restart it while recording and
 * keep every finished segment in `committedRef`.
 */
export function useRecorder({ lang }) {
  const [status, setStatus] = useState('idle') // idle | starting | recording | stopping
  const [elapsed, setElapsed] = useState(0)
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)

  const analyserRef = useRef(null)
  const recRef = useRef(null)
  const streamRef = useRef(null)
  const ctxRef = useRef(null)
  const mediaRecRef = useRef(null)
  const chunksRef = useRef([])
  const committedRef = useRef('') // text from finished recognition sessions
  const sessionRef = useRef([]) // final results in the current recognition session
  const activeRef = useRef(false)
  const startedAtRef = useRef(0)
  const timerRef = useRef(null)
  const wakeRef = useRef(null)
  const recEndedRef = useRef(null)

  const sessionText = () => sessionRef.current.join(' ').replace(/\s+/g, ' ').trim()
  const fullText = () => `${committedRef.current} ${sessionText()}`.replace(/\s+/g, ' ').trim()

  const startRecognition = useCallback(() => {
    if (!SpeechRecognition) return
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = lang
    sessionRef.current = []

    rec.onresult = (e) => {
      const finals = []
      let live = ''
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim()
        if (!t) continue
        if (e.results[i].isFinal) {
          // Android Chrome repeats earlier text inside later results; keep the longer one.
          const prev = finals[finals.length - 1]
          if (prev && t.toLowerCase().startsWith(prev.toLowerCase())) finals[finals.length - 1] = t
          else finals.push(t)
        } else live += `${t} `
      }
      sessionRef.current = finals
      setFinalText(fullText())
      setInterim(live.trim())
    }

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone or speech access was blocked. Allow it in your browser settings.')
        activeRef.current = false
      } else if (e.error === 'network') {
        setError('Speech service needs a connection. Audio is still being recorded.')
      } else if (e.error === 'language-not-supported') {
        setError('That language is not supported here. Pick another one.')
        activeRef.current = false
      }
    }

    rec.onend = () => {
      committedRef.current = fullText()
      sessionRef.current = []
      setInterim('')
      if (activeRef.current) {
        try {
          rec.start()
          return
        } catch {
          /* fall through */
        }
      }
      recRef.current = null
      recEndedRef.current?.()
    }

    recRef.current = rec
    try {
      rec.start()
    } catch {
      /* already started */
    }
  }, [lang])

  const start = useCallback(async () => {
    if (status !== 'idle') return
    setError(null)
    setStatus('starting')
    committedRef.current = ''
    sessionRef.current = []
    chunksRef.current = []
    setFinalText('')
    setInterim('')
    setElapsed(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream

      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.82
      ctx.createMediaStreamSource(stream).connect(analyser)
      ctxRef.current = ctx
      analyserRef.current = analyser

      if (window.MediaRecorder) {
        const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) =>
          MediaRecorder.isTypeSupported?.(t)
        )
        const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
        mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
        mr.start(1000)
        mediaRecRef.current = mr
      }
    } catch (err) {
      setStatus('idle')
      setError(
        err?.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in your browser settings and try again.'
          : 'Could not reach a microphone on this device.'
      )
      return
    }

    activeRef.current = true
    startRecognition()

    try {
      wakeRef.current = await navigator.wakeLock?.request('screen')
    } catch {
      /* not critical */
    }

    startedAtRef.current = Date.now()
    timerRef.current = setInterval(() => setElapsed((Date.now() - startedAtRef.current) / 1000), 250)
    navigator.vibrate?.(18)
    setStatus('recording')
  }, [status, startRecognition])

  const teardown = useCallback(() => {
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    analyserRef.current = null
    wakeRef.current?.release?.().catch(() => {})
    wakeRef.current = null
  }, [])

  /** Stops everything and resolves with { transcript, audio, duration }. */
  const stop = useCallback(async () => {
    if (status !== 'recording') return null
    setStatus('stopping')
    activeRef.current = false
    navigator.vibrate?.([12, 40, 12])
    const duration = (Date.now() - startedAtRef.current) / 1000

    // Let recognition flush its last words (it fires onend once done).
    const recDone = recRef.current
      ? new Promise((resolve) => {
          recEndedRef.current = resolve
          setTimeout(resolve, 1500)
          try {
            recRef.current.stop()
          } catch {
            resolve()
          }
        })
      : Promise.resolve()

    const audioDone = new Promise((resolve) => {
      const mr = mediaRecRef.current
      if (!mr || mr.state === 'inactive') return resolve(null)
      mr.onstop = () =>
        resolve(chunksRef.current.length ? new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' }) : null)
      mr.stop()
    })

    const [, audio] = await Promise.all([recDone, audioDone])
    recEndedRef.current = null
    mediaRecRef.current = null
    teardown()

    const transcript = fullText()
    setInterim('')
    setStatus('idle')
    return { transcript, audio, duration }
  }, [status, teardown])

  const cancel = useCallback(() => {
    activeRef.current = false
    try {
      recRef.current?.abort()
    } catch {
      /* ignore */
    }
    try {
      mediaRecRef.current?.stop()
    } catch {
      /* ignore */
    }
    mediaRecRef.current = null
    teardown()
    setInterim('')
    setFinalText('')
    setStatus('idle')
  }, [teardown])

  // Release the screen lock if the user switches away and back.
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === 'visible' && status === 'recording' && (!wakeRef.current || wakeRef.current.released)) {
        try {
          wakeRef.current = await navigator.wakeLock?.request('screen')
        } catch {
          /* ignore */
        }
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [status])

  useEffect(() => () => cancel(), []) // eslint-disable-line react-hooks/exhaustive-deps

  return { status, elapsed, finalText, interim, error, setError, analyserRef, start, stop, cancel }
}
