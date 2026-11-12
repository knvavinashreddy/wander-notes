import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { LayoutGrid, Mic, Repeat2, Sparkles } from 'lucide-react'
import IdeaCard from './IdeaCard.jsx'
import { Confetti } from './Visuals.jsx'

function Sheet({ open, onClose, children, label }) {
  const controls = useDragControls()
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ y: 80, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => i.offset.y > 120 && onClose()}
          >
            <div className="mob-only" style={{ padding: '4px 0 2px', touchAction: 'none', cursor: 'grab' }} onPointerDown={(e) => controls.start(e)}>
              <div className="grabber" />
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function CountUp({ to, duration = 900 }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration)
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, duration])
  return v
}

export function RevealSheet({ result, onClose, onBoard, onAgain }) {
  const n = result?.ideas.length ?? 0
  return (
    <>
      <Confetti fire={result && n > 0 ? result.note.id : null} />
      <Sheet open={!!result} onClose={onClose} label="Walk summary">
        {result && (
          <>
            <h2>
              {n ? (
                <>
                  {n} <em>{n === 1 ? 'spark' : 'sparks'}</em> from your walk
                </>
              ) : result.repeats.length ? (
                <>
                  Old ideas, <em>stronger</em>
                </>
              ) : (
                <>No sparks this time</>
              )}
            </h2>
            <p className="sheet-sub">
              {n
                ? 'Sorted, scored and saved to your board. The crowned ones stood out most.'
                : result.repeats.length
                  ? 'Nothing new, but you came back to ideas you already had.'
                  : 'Try saying “what if…” or “I should…” to flag ideas. Your transcript is still saved.'}
            </p>

            <div className="stat-row">
              <div className="stat">
                <b>
                  <CountUp to={Math.max(1, Math.round(result.note.duration / 60))} />
                </b>
                <span>{result.note.typed ? 'typed note' : 'minutes'}</span>
              </div>
              <div className="stat">
                <b>
                  <CountUp to={result.note.words} />
                </b>
                <span>words</span>
              </div>
              <div className="stat">
                <b>
                  <CountUp to={n} />
                </b>
                <span>new ideas</span>
              </div>
            </div>

            {result.repeats.length > 0 && (
              <p className="sheet-sub" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--violet-2)' }}>
                <Repeat2 size={16} /> You came back to {result.repeats.length} earlier{' '}
                {result.repeats.length === 1 ? 'idea' : 'ideas'}. They got a boost.
              </p>
            )}

            <div className="sheet-list">
              {result.ideas.map((i, idx) => (
                <IdeaCard key={i.id} idea={i} compact index={idx} />
              ))}
            </div>

            <div className="sheet-actions">
              <button className="btn" onClick={onAgain}>
                <Mic size={16} /> Record another
              </button>
              <button className="btn primary" onClick={onBoard}>
                <LayoutGrid size={16} /> Open idea board
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  )
}

export function TypeSheet({ open, onClose, onSubmit }) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (open) setText('')
  }, [open])
  return (
    <Sheet open={open} onClose={onClose} label="Type a note">
      <h2>
        Type or <em>paste</em>
      </h2>
      <p className="sheet-sub">Dump your thoughts, or paste a transcript from another app. Wander pulls out the ideas.</p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What if…"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) onSubmit(text)
        }}
      />
      <div className="sheet-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={!text.trim()} onClick={() => onSubmit(text)}>
          <Sparkles size={16} /> Find my ideas
        </button>
      </div>
    </Sheet>
  )
}

export function Toasts({ items, onAction }) {
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            className="toast"
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <span>{t.msg}</span>
            {t.action && <button onClick={() => onAction(t)}>{t.action.label}</button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
