import { forwardRef, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Crown, Pencil, Repeat2, Star, Trash2 } from 'lucide-react'
import { CATEGORIES } from '../lib/ideas.js'
import { SparkRing } from './Visuals.jsx'

export function timeAgo(t) {
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const IdeaCard = forwardRef(function IdeaCard({ idea, onChange, onDelete, onCopy, compact, index = 0 }, ref) {
  const cat = CATEGORIES[idea.category] ?? CATEGORIES.thought
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const titleRef = useRef(null)

  const startEdit = () => {
    setEditing(true)
    requestAnimationFrame(() => {
      const el = titleRef.current
      el?.focus()
      const r = document.createRange()
      r.selectNodeContents(el)
      r.collapse(false)
      const sel = getSelection()
      sel.removeAllRanges()
      sel.addRange(r)
    })
  }

  const commit = () => {
    setEditing(false)
    const v = titleRef.current?.textContent.trim()
    if (v && v !== idea.title) onChange?.({ title: v })
    else if (titleRef.current) titleRef.current.textContent = idea.title
  }

  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30, delay: compact ? index * 0.09 : 0 }}
      className={`idea${idea.best ? ' best' : ''}${idea.done ? ' done' : ''}`}
      style={{ '--h': cat.hue }}
    >
      <div className="idea-top">
        <span className="cat">
          <span aria-hidden>{cat.emoji}</span>
          {cat.label}
        </span>
        {idea.best && (
          <span className="badge gold">
            <Crown size={11} /> Best
          </span>
        )}
        {idea.mentions > 1 && (
          <span className="badge soft" title="You brought this up again on another walk">
            <Repeat2 size={11} /> ×{idea.mentions}
          </span>
        )}
        <SparkRing value={idea.spark} hue={cat.hue} />
      </div>

      <h3
        ref={titleRef}
        className="idea-title"
        contentEditable={editing}
        suppressContentEditableWarning
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') {
            e.currentTarget.textContent = idea.title
            e.currentTarget.blur()
          }
        }}
        onDoubleClick={() => !compact && startEdit()}
      >
        {idea.title}
      </h3>

      <p
        className={`idea-text${open ? '' : ' clamp'}`}
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer' }}
        title={open ? 'Collapse' : 'Show the full thought'}
      >
        {idea.text}
      </p>

      {idea.tags?.length > 0 && (
        <div className="tags">
          {idea.tags.map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      )}

      {!compact && (
        <div className="idea-foot">
          <span className="when">{timeAgo(idea.createdAt)}</span>
          <button
            className={`icon-btn${idea.starred ? ' on-star' : ''}`}
            onClick={() => {
              navigator.vibrate?.(8)
              onChange({ starred: !idea.starred })
            }}
            aria-label={idea.starred ? 'Unpin' : 'Pin to top'}
            title={idea.starred ? 'Unpin' : 'Pin to top'}
          >
            <Star size={17} fill={idea.starred ? 'currentColor' : 'none'} />
          </button>
          <button
            className={`icon-btn${idea.done ? ' on-done' : ''}`}
            onClick={() => onChange({ done: !idea.done })}
            aria-label={idea.done ? 'Mark as open' : 'Mark as done'}
            title={idea.done ? 'Mark as open' : 'Mark as done'}
          >
            <Check size={17} />
          </button>
          <button className="icon-btn" onClick={startEdit} aria-label="Rename" title="Rename">
            <Pencil size={16} />
          </button>
          <button className="icon-btn" onClick={onCopy} aria-label="Copy" title="Copy">
            <Copy size={16} />
          </button>
          <button className="icon-btn" onClick={onDelete} aria-label="Delete" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </motion.article>
  )
})

export default IdeaCard
