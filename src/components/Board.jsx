import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ArrowDownWideNarrow, Clock, Download, Eye, EyeOff, FileText, Mic, Search, Trash2, Wand2, X } from 'lucide-react'
import IdeaCard, { timeAgo } from './IdeaCard.jsx'
import { CATEGORIES } from '../lib/ideas.js'
import { loadAudio } from '../lib/store.js'

function Seg({ value, onChange, options, id }) {
  return (
    <div className="seg" role="tablist">
      {options.map(([v, label, Icon]) => (
        <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {value === v && <motion.span layoutId={`seg-${id}`} className="seg-bg" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
          {Icon && <Icon size={14} />}
          {label}
        </button>
      ))}
    </div>
  )
}

export function IdeasBoard({ ideas, onChange, onDelete, onCopy, onExport, onDemo, onRecord }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [sort, setSort] = useState('best')
  const [hideDone, setHideDone] = useState(false)

  const counts = useMemo(() => {
    const c = {}
    for (const i of ideas) c[i.category] = (c[i.category] || 0) + 1
    return c
  }, [ideas])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return ideas
      .filter((i) => cat === 'all' || i.category === cat)
      .filter((i) => !hideDone || !i.done)
      .filter((i) => !needle || `${i.title} ${i.text} ${i.tags?.join(' ')}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1
        return sort === 'best' ? b.spark + (b.mentions - 1) * 5 - (a.spark + (a.mentions - 1) * 5) : b.createdAt - a.createdAt
      })
  }, [ideas, q, cat, sort, hideDone])

  const pinned = list.filter((i) => i.starred)
  const rest = list.filter((i) => !i.starred)

  const card = (i) => (
    <IdeaCard
      key={i.id}
      idea={i}
      onChange={(patch) => onChange(i.id, patch)}
      onDelete={() => onDelete(i.id)}
      onCopy={() => onCopy(i)}
    />
  )

  return (
    <section aria-label="Ideas">
      <div className="toolbar">
        <label className="search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ideas, tags…" />
          {q && (
            <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setQ('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </label>
        <Seg
          id="sort"
          value={sort}
          onChange={setSort}
          options={[
            ['best', 'Best', ArrowDownWideNarrow],
            ['new', 'Newest', Clock],
          ]}
        />
        <button className="btn sm" onClick={() => setHideDone((h) => !h)} title={hideDone ? 'Show finished ideas' : 'Hide finished ideas'} aria-label={hideDone ? 'Show finished ideas' : 'Hide finished ideas'}>
          {hideDone ? <EyeOff size={15} /> : <Eye size={15} />} <span className="lbl">Done</span>
        </button>
        <button className="btn sm" onClick={onExport} disabled={!ideas.length} title="Download as Markdown" aria-label="Export as Markdown">
          <Download size={15} /> <span className="lbl">Export</span>
        </button>
      </div>

      <div className="chips">
        <button className={`chip${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')}>
          ✨ All <span className="count">{ideas.length}</span>
        </button>
        {Object.entries(CATEGORIES)
          .filter(([k]) => counts[k])
          .map(([k, c]) => (
            <button key={k} className={`chip${cat === k ? ' on' : ''}`} style={{ '--h': c.hue }} onClick={() => setCat(k)}>
              {c.emoji} {c.label} <span className="count">{counts[k]}</span>
            </button>
          ))}
      </div>

      <LayoutGroup>
        <motion.div className="cards" layout>
          {!ideas.length ? (
            <div className="empty glass">
              <div className="empty-orb" />
              <h3>Your idea board is empty</h3>
              <p>Go for a walk and talk it out. Wander keeps the good parts here, sorted and scored.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn primary" onClick={onRecord}>
                  <Mic size={16} /> Start a walk
                </button>
                <button className="btn" onClick={onDemo}>
                  <Wand2 size={16} /> Try a demo
                </button>
              </div>
            </div>
          ) : !list.length ? (
            <div className="empty">
              <h3>Nothing matches</h3>
              <p>Try another word or category.</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {pinned.length > 0 && (
                <motion.div layout key="l-pinned" className="section-label">
                  ⭐ Pinned
                </motion.div>
              )}
              {pinned.map(card)}
              {pinned.length > 0 && rest.length > 0 && (
                <motion.div layout key="l-rest" className="section-label">
                  Everything else
                </motion.div>
              )}
              {rest.map(card)}
            </AnimatePresence>
          )}
        </motion.div>
      </LayoutGroup>
    </section>
  )
}

function AudioPlayer({ id }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let u
    loadAudio(id).then((blob) => {
      if (blob) setUrl((u = URL.createObjectURL(blob)))
    })
    return () => u && URL.revokeObjectURL(u)
  }, [id])
  return url ? <audio controls preload="metadata" src={url} /> : null
}

export function NotesList({ notes, ideas, onDelete, onRecord }) {
  const [open, setOpen] = useState(null)
  if (!notes.length)
    return (
      <div className="cards">
        <div className="empty glass">
          <div className="empty-orb" />
          <h3>No walks yet</h3>
          <p>Every recording lands here with its full transcript and audio, so nothing is lost.</p>
          <button className="btn primary" onClick={onRecord}>
            <Mic size={16} /> Record your first
          </button>
        </div>
      </div>
    )

  return (
    <div className="cards" style={{ gridTemplateColumns: '1fr' }}>
      <AnimatePresence mode="popLayout">
        {notes.map((n) => {
          const d = new Date(n.createdAt)
          const count = ideas.filter((i) => i.noteId === n.id).length
          const isOpen = open === n.id
          return (
            <motion.article
              key={n.id}
              layout
              className="glass note"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="note-head">
                <div className="note-icon">{n.typed ? <FileText size={18} /> : <Mic size={18} />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="note-date">
                    {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
                    {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  <div className="note-sub">{timeAgo(n.createdAt)}</div>
                </div>
                <button className="icon-btn" onClick={() => onDelete(n.id)} aria-label="Delete note" title="Delete note (keeps ideas)">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="note-stats">
                {!n.typed && <span className="badge soft">⏱ {Math.max(1, Math.round(n.duration / 60))} min</span>}
                <span className="badge soft">🗣 {n.words} words</span>
                <span className="badge soft">✨ {count} ideas</span>
              </div>
              {n.hasAudio && <AudioPlayer id={n.id} />}
              <p className={`note-text${isOpen ? '' : ' idea-text clamp'}`}>{n.transcript || <em>No words captured.</em>}</p>
              {n.transcript && (
                <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(isOpen ? null : n.id)}>
                  {isOpen ? 'Show less' : 'Read full transcript'}
                </button>
              )}
            </motion.article>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export { Seg }
