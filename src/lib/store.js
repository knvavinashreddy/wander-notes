import { useCallback, useEffect, useState } from 'react'

const KEY = 'wander:v1'
const empty = { notes: [], ideas: [] }

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty, ...JSON.parse(raw) } : empty
  } catch {
    return empty
  }
}

/** Notes + ideas live in localStorage; audio blobs live in IndexedDB. */
export function useStore() {
  const [data, setData] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* storage full or blocked */
    }
  }, [data])

  const update = useCallback((fn) => setData((d) => fn(d)), [])
  return [data, update]
}

/* ---------- IndexedDB for audio ---------- */

let dbp
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('wander-audio', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('audio')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbp
}

async function tx(mode, fn) {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction('audio', mode)
    const req = fn(t.objectStore('audio'))
    t.oncomplete = () => resolve(req?.result)
    t.onerror = () => reject(t.error)
  })
}

export const saveAudio = (id, blob) => tx('readwrite', (s) => s.put(blob, id)).catch(() => {})
export const loadAudio = (id) => tx('readonly', (s) => s.get(id)).catch(() => null)
export const deleteAudio = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {})

/* ---------- stats ---------- */

const dayKey = (t) => new Date(t).toDateString()

export function streakOf(notes) {
  const days = new Set(notes.map((n) => dayKey(n.createdAt)))
  let streak = 0
  const d = new Date()
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1) // today not done yet: keep yesterday's streak alive
  while (days.has(dayKey(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export function toMarkdown(ideas, categories) {
  const groups = {}
  for (const i of ideas) (groups[i.category] ||= []).push(i)
  let md = `# Wander ideas\n\n_Exported ${new Date().toLocaleString()}_\n`
  for (const [k, list] of Object.entries(groups)) {
    md += `\n## ${categories[k]?.emoji ?? ''} ${categories[k]?.label ?? k}\n\n`
    for (const i of list.sort((a, b) => b.spark - a.spark)) {
      md += `- [${i.done ? 'x' : ' '}] **${i.title}**${i.starred ? ' ⭐' : ''} (spark ${i.spark})\n  ${i.text}\n`
    }
  }
  return md
}
