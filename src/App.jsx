import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame, Lightbulb, ListMusic, Mic, Sparkles } from 'lucide-react'
import { Aurora } from './components/Visuals.jsx'
import Recorder from './components/Recorder.jsx'
import { IdeasBoard, NotesList, Seg } from './components/Board.jsx'
import { RevealSheet, Toasts, TypeSheet } from './components/Sheets.jsx'
import { useRecorder, speechSupported } from './lib/useRecorder.js'
import { DEMO_TRANSCRIPT, CATEGORIES, extractIdeas, wordCount } from './lib/ideas.js'
import { deleteAudio, saveAudio, streakOf, toMarkdown, useStore } from './lib/store.js'

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function useMedia(q) {
  const [m, setM] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const mq = matchMedia(q)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

function defaultLang() {
  try {
    return localStorage.getItem('wander:lang') || navigator.language || 'en-US'
  } catch {
    return 'en-US'
  }
}

export default function App() {
  const [data, update] = useStore()
  const dataRef = useRef(data)
  dataRef.current = data

  const [lang, setLang] = useState(defaultLang)
  const rec = useRecorder({ lang })
  const isDesktop = useMedia('(min-width: 1024px)')
  const [tab, setTab] = useState('walk')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [typeOpen, setTypeOpen] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    try {
      localStorage.setItem('wander:lang', lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const view = isDesktop ? (tab === 'walk' ? 'ideas' : tab) : tab
  useEffect(() => {
    if (view === 'ideas') setUnseen(0)
  }, [view])

  /* ---------- toasts ---------- */

  const toast = useCallback((msg, opts = {}) => {
    const id = uid()
    const t = { id, msg, ...opts }
    setToasts((ts) => [...ts.slice(-2), t])
    setTimeout(() => {
      setToasts((ts) => {
        const still = ts.find((x) => x.id === id)
        if (still && !still.undone) still.onExpire?.()
        return ts.filter((x) => x.id !== id)
      })
    }, opts.ms ?? 3800)
  }, [])

  const onToastAction = (t) => {
    t.undone = true
    t.action.run()
    setToasts((ts) => ts.filter((x) => x.id !== t.id))
  }

  /* ---------- pipeline ---------- */

  const process = useCallback(
    async (transcript, { audio = null, duration = 0, typed = false } = {}) => {
      setProcessing(true)
      if (!isDesktop) setTab('walk')
      const noteId = uid()
      await sleep(1500) // let the distill animation breathe
      const { ideas, repeats } = extractIdeas(transcript, { noteId, existing: dataRef.current.ideas })
      const note = {
        id: noteId,
        createdAt: Date.now(),
        duration,
        transcript: transcript.trim(),
        words: wordCount(transcript),
        hasAudio: Boolean(audio),
        typed,
      }
      if (audio) await saveAudio(noteId, audio)
      update((d) => ({
        notes: [note, ...d.notes],
        ideas: [
          ...ideas,
          ...d.ideas.map((i) =>
            repeats.includes(i.id) ? { ...i, mentions: (i.mentions || 1) + 1, spark: Math.min(99, i.spark + 5) } : i
          ),
        ],
      }))
      setProcessing(false)
      setResult({ note, ideas, repeats })
      setUnseen((u) => u + ideas.length)
      navigator.vibrate?.(ideas.length ? [20, 60, 20, 60, 40] : 30)
    },
    [isDesktop, update]
  )

  const toggle = useCallback(async () => {
    if (processing) return
    if (rec.status === 'idle') {
      if (!isDesktop) setTab('walk')
      return rec.start()
    }
    if (rec.status !== 'recording') return
    const res = await rec.stop()
    if (!res) return
    if (res.transcript.trim()) return process(res.transcript, res)

    if (res.audio && res.duration > 2) {
      const id = uid()
      await saveAudio(id, res.audio)
      update((d) => ({
        ...d,
        notes: [{ id, createdAt: Date.now(), duration: res.duration, transcript: '', words: 0, hasAudio: true }, ...d.notes],
      }))
      toast(
        speechSupported ? 'No words caught, but the audio is saved in Notes.' : 'Audio saved. Type the gist to pull out ideas.',
        { action: { label: 'Type it', run: () => setTypeOpen(true) }, ms: 6000 }
      )
    } else toast('Didn’t catch anything. Try speaking a little closer.')
  }, [processing, rec, isDesktop, process, update, toast])

  // Space to start/stop on desktop.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.repeat || typeOpen || result) return
      const el = e.target
      if (el.closest?.('input, textarea, select, button, [contenteditable="true"]')) return
      e.preventDefault()
      toggle()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [toggle, typeOpen, result])

  /* ---------- idea + note actions ---------- */

  const changeIdea = (id, patch) => update((d) => ({ ...d, ideas: d.ideas.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))

  const deleteIdea = (id) => {
    const idx = data.ideas.findIndex((i) => i.id === id)
    const idea = data.ideas[idx]
    update((d) => ({ ...d, ideas: d.ideas.filter((i) => i.id !== id) }))
    toast('Idea deleted', {
      action: {
        label: 'Undo',
        run: () =>
          update((d) => {
            const ideas = [...d.ideas]
            ideas.splice(Math.min(idx, ideas.length), 0, idea)
            return { ...d, ideas }
          }),
      },
    })
  }

  const deleteNote = (id) => {
    const note = data.notes.find((n) => n.id === id)
    update((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }))
    toast('Walk deleted. Its ideas stay on your board.', {
      action: { label: 'Undo', run: () => update((d) => ({ ...d, notes: [note, ...d.notes].sort((a, b) => b.createdAt - a.createdAt) })) },
      onExpire: () => deleteAudio(id),
    })
  }

  const copyIdea = async (i) => {
    try {
      await navigator.clipboard.writeText(`${i.title}\n\n${i.text}`)
      toast('Copied to clipboard')
    } catch {
      toast('Couldn’t copy on this device')
    }
  }

  const exportAll = () => {
    const blob = new Blob([toMarkdown(data.ideas, CATEGORIES)], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `wander-ideas-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toast(`Exported ${data.ideas.length} ideas as Markdown`)
  }

  const startWalk = () => {
    setResult(null)
    setTab('walk')
    if (isDesktop) rec.start()
  }

  const streak = streakOf(data.notes)
  const minutes = Math.round(data.notes.reduce((s, n) => s + (n.duration || 0), 0) / 60)
  const live = rec.status === 'recording'

  const recorder = (
    <Recorder
      rec={rec}
      lang={lang}
      setLang={setLang}
      processing={processing}
      onToggle={toggle}
      onCancel={() => {
        rec.cancel()
        toast('Recording discarded')
      }}
      onType={() => setTypeOpen(true)}
      onDemo={() => process(DEMO_TRANSCRIPT, { duration: 184, typed: false })}
    />
  )

  const rightPanel = (
    <div>
      <div className="panel-head">
        <h2 className="panel-title">
          {view === 'notes' ? 'Your walks' : 'Your ideas'}
          <sup>{view === 'notes' ? data.notes.length : data.ideas.length}</sup>
        </h2>
        {isDesktop && (
          <Seg
            id="view"
            value={view}
            onChange={setTab}
            options={[
              ['ideas', 'Ideas', Lightbulb],
              ['notes', 'Walks', ListMusic],
            ]}
          />
        )}
      </div>
      {view === 'notes' ? (
        <NotesList notes={data.notes} ideas={data.ideas} onDelete={deleteNote} onRecord={startWalk} />
      ) : (
        <IdeasBoard
          ideas={data.ideas}
          onChange={changeIdea}
          onDelete={deleteIdea}
          onCopy={copyIdea}
          onExport={exportAll}
          onRecord={startWalk}
          onDemo={() => {
            setTab('walk')
            process(DEMO_TRANSCRIPT, { duration: 184 })
          }}
        />
      )}
    </div>
  )

  return (
    <>
      <Aurora live={live} />
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <Sparkles size={17} color="#fff" />
            </div>
            <span className="brand-name">wander</span>
          </div>
          <div className="pills">
            <span className="pill flame" title="Days in a row with at least one walk">
              <Flame size={15} /> <b>{streak}</b> day{streak === 1 ? '' : 's'}
            </span>
            <span className="pill hide-sm" title="Ideas saved">
              <Lightbulb size={15} /> <b>{data.ideas.length}</b> ideas
            </span>
            <span className="pill hide-sm desk-only" title="Total minutes recorded">
              <Mic size={15} /> <b>{minutes}</b> min
            </span>
          </div>
        </header>

        {isDesktop ? (
          <div className="grid">
            <div className="left">{recorder}</div>
            {rightPanel}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.main
              key={view}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {view === 'walk' ? recorder : rightPanel}
            </motion.main>
          </AnimatePresence>
        )}
      </div>

      <nav className="nav" aria-label="Sections">
        {[
          ['walk', 'Walk', live ? null : Mic],
          ['ideas', 'Ideas', Lightbulb],
          ['notes', 'Walks', ListMusic],
        ].map(([k, label, Icon]) => (
          <button key={k} className={view === k ? 'on' : ''} onClick={() => setTab(k)} aria-current={view === k}>
            {view === k && <motion.span layoutId="nav-bg" className="nav-bg" transition={{ type: 'spring', stiffness: 480, damping: 34 }} />}
            {Icon ? <Icon size={17} /> : <span className="rec-dot" />}
            {label}
            {k === 'ideas' && unseen > 0 && view !== 'ideas' && <span className="dot">{unseen}</span>}
          </button>
        ))}
      </nav>

      <RevealSheet
        result={result}
        onClose={() => setResult(null)}
        onBoard={() => {
          setResult(null)
          setTab('ideas')
        }}
        onAgain={startWalk}
      />
      <TypeSheet
        open={typeOpen}
        onClose={() => setTypeOpen(false)}
        onSubmit={(text) => {
          setTypeOpen(false)
          process(text, { typed: true })
        }}
      />
      <Toasts items={toasts} onAction={onToastAction} />
    </>
  )
}
