import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Keyboard, Mic, Sparkles, Wand2, X } from 'lucide-react'
import { Waveform } from './Visuals.jsx'
import { speechSupported } from '../lib/useRecorder.js'
import { wordCount } from '../lib/ideas.js'

const TIPS = [
  'Say “what if…” and I’ll flag it as an idea',
  'Pause between thoughts, I’ll split them for you',
  '“I need to…” becomes a to-do',
  'Repeat an old idea and it gets a boost',
  'Ramble freely. Only the sparks are kept',
]

export const LANGS = [
  ['en-US', 'English (US)'],
  ['en-IN', 'English (India)'],
  ['en-GB', 'English (UK)'],
  ['hi-IN', 'हिन्दी'],
  ['te-IN', 'తెలుగు'],
  ['es-ES', 'Español'],
  ['fr-FR', 'Français'],
  ['de-DE', 'Deutsch'],
]

const STEPS = ['Cleaning up the transcript', 'Finding your sparks', 'Sorting them into piles']

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function Recorder({ rec, lang, setLang, processing, onToggle, onCancel, onType, onDemo }) {
  const orbRef = useRef(null)
  const [tip, setTip] = useState(0)
  const [step, setStep] = useState(0)
  const live = rec.status === 'recording'
  const busy = rec.status === 'starting' || rec.status === 'stopping'

  useEffect(() => {
    if (live) return
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 4200)
    return () => clearInterval(id)
  }, [live])

  useEffect(() => {
    if (!processing) return setStep(0)
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length)), 420)
    return () => clearInterval(id)
  }, [processing])

  const text = rec.finalText
  const shown = text.split(' ').slice(-60).join(' ')
  const words = wordCount(`${text} ${rec.interim}`)

  return (
    <section className="glass recorder" aria-label="Recorder">
      <div className="rec-eyebrow">
        {live ? (
          <>
            <span className="live-dot" /> Listening
          </>
        ) : processing ? (
          <>
            <Sparkles size={13} /> Distilling
          </>
        ) : (
          'Voice notes for walkers'
        )}
      </div>

      <h1 className="rec-title">
        {live ? (
          <>
            Keep <em>talking</em>
          </>
        ) : processing ? (
          <>
            Finding the <em>gold</em>
          </>
        ) : (
          <>
            Walk. Talk. <em>Keep the sparks.</em>
          </>
        )}
      </h1>

      <div className="hint">
        <AnimatePresence mode="wait">
          <motion.span
            key={live ? `w${words > 0}` : processing ? 'p' : tip}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            {live
              ? words
                ? `${words} words so far`
                : 'Say anything. I’m transcribing live'
              : processing
                ? 'This happens on your device'
                : TIPS[tip]}
          </motion.span>
        </AnimatePresence>
      </div>

      {processing ? (
        <div className="distill">
          {STEPS.map((s, i) => (
            <motion.div
              key={s}
              className={`distill-step${step > i ? ' on' : ''}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12 }}
            >
              <span className="tick">{step > i && <Check size={14} />}</span>
              <span className={step === i ? 'shimmer' : ''}>{s}</span>
            </motion.div>
          ))}
        </div>
      ) : (
        <>
          <div className="orb-wrap" ref={orbRef}>
            <div className="orb-ring" />
            <div className="orb-ring r2" />
            <div className="orb-ring r3" />
            <motion.button
              className={`orb ${live ? 'live' : 'idle'}`}
              onClick={onToggle}
              disabled={busy}
              whileTap={{ scale: 0.93 }}
              aria-label={live ? 'Stop recording' : 'Start recording'}
            >
              <span className="orb-icon">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={live ? 'stop' : 'mic'}
                    initial={{ scale: 0.4, opacity: 0, rotate: -40 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.4, opacity: 0, rotate: 40 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                    style={{ display: 'grid' }}
                  >
                    {live ? <span className="stop-square" /> : <Mic size={26} strokeWidth={2.2} />}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.button>
          </div>

          <div className="timer">
            {fmt(rec.elapsed)}
            <small>{live ? 'tap orb to finish' : busy ? 'one sec…' : 'tap orb to start'}</small>
          </div>

          <Waveform analyserRef={rec.analyserRef} active={live} levelTarget={orbRef} />

          <AnimatePresence>
            {(live || text) && (
              <motion.div
                className="transcript"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                aria-live="polite"
              >
                {shown || rec.interim ? (
                  <p style={{ margin: 0 }}>
                    {shown} <span className="interim">{rec.interim}</span>
                    <span className="caret" />
                  </p>
                ) : (
                  <p className="placeholder" style={{ margin: 0 }}>
                    {speechSupported ? 'Your words will appear here…' : 'Recording audio only in this browser…'}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {rec.error && <div className="notice">{rec.error}</div>}
      {!speechSupported && !rec.error && (
        <div className="notice info">
          This browser can’t transcribe live. Use Chrome, Edge or Safari, or type your note instead.
        </div>
      )}

      {!processing && (
        <div className="rec-actions">
          {live ? (
            <>
              <button className="btn ghost sm" onClick={onCancel}>
                <X size={15} /> Discard
              </button>
              <button className="btn primary sm" onClick={onToggle}>
                <Check size={15} /> Finish walk
              </button>
            </>
          ) : (
            <>
              <button className="btn sm" onClick={onType}>
                <Keyboard size={15} /> Type instead
              </button>
              <button className="btn sm" onClick={onDemo}>
                <Wand2 size={15} /> Try a demo walk
              </button>
            </>
          )}
        </div>
      )}

      {!live && !processing && (
        <label className="lang">
          Language
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <span className="desk-only" style={{ alignItems: 'center', gap: 6 }}>
            · <span className="kbd">Space</span> to record
          </span>
        </label>
      )}
    </section>
  )
}
