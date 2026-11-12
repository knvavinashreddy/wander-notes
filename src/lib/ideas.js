/**
 * On-device idea extraction. No network, no model: we split the transcript
 * into thoughts, score each one for "idea-ness", then categorise and title it.
 */

const STOP = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by
  can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has
  hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if
  in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our
  ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their
  theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until
  up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom
  why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves just really like yeah okay
  ok gonna wanna gotta thing things stuff something maybe also actually basically kind sort lot lots get got going go make
  think thought know want need one two way pretty right well even still much many could would should will can now today
  idea ideas um uh hmm thinking realized realised instead people anyone someone every week day`.split(/\s+/)
)

const FILLERS = /\b(um+|uh+|erm+|hmm+|you know|i mean|basically|literally)\b[,]?\s*/gi

const MARKERS =
  "another thing|another idea|one more thing|the other thing|next thing|oh and|okay so|ok so|alright so|anyway|what if|secondly|thirdly|number two|number three|also|i was thinking|i've been thinking|here's an idea|how about|what about|i realized|i realised|i need to|i want to|i should|we should|maybe i should|maybe we should|remember to|don't forget"

const TRIGGERS = [
  [/\bwhat if\b/, 3],
  [/\b(here's an idea|an idea|another idea|new idea|idea is|idea for)\b/, 3],
  [/\bimagine\b/, 2],
  [/\b(what|how) about\b/, 2],
  [/\bi wonder\b/, 1.5],
  [/\b(we|i|you) (could|should|can|might)\b/, 2],
  [/\bmaybe\b/, 0.8],
  [/\b(build|create|make|launch|start|write|design|ship|record|automate|turn .* into|sell|teach|post)\b/, 1.5],
  [/\b(app|tool|feature|product|business|startup|side project|newsletter|channel|course|service|platform|website|bot|plugin)\b/, 1.5],
  [/\b(need to|have to|must|remember to|don't forget|gotta)\b/, 1.5],
  [/\b(i want to|i'd love to|let's)\b/, 1],
  [/\b(the key|the trick|insight|realiz\w*|lesson|the problem is|real problem|nobody|no one|everyone)\b/, 2],
  [/\b(better|faster|cheaper|simpler|easier|smarter)\b/, 1],
  [/\b(instead of|rather than|combine|mix of)\b/, 1.2],
]

const DULL = /\b(weather|nice day|so tired|whatever|nevermind|never mind|lol|testing|hello|can you hear)\b/

export const CATEGORIES = {
  build: { label: 'Build', hue: 265, emoji: '🛠️' },
  business: { label: 'Business', hue: 150, emoji: '💸' },
  content: { label: 'Content', hue: 330, emoji: '🎬' },
  action: { label: 'To-do', hue: 35, emoji: '✅' },
  life: { label: 'Life', hue: 190, emoji: '🌿' },
  learn: { label: 'Learn', hue: 210, emoji: '📚' },
  thought: { label: 'Thought', hue: 285, emoji: '💭' },
}

const LEXICON = {
  build: /\b(app|apps|tool|feature|build|code|coding|website|site|api|design|ui|ux|prototype|automate|automation|bot|plugin|extension|dashboard|software|react|ai|model|database|mobile)\b/g,
  business: /\b(money|customer|customers|client|clients|sell|selling|price|pricing|revenue|market|marketing|startup|business|subscription|profit|pitch|investor|sales|brand|niche|charge|paid|freelanc\w*|saas)\b/g,
  content: /\b(post|posts|video|videos|youtube|blog|write|writing|linkedin|twitter|instagram|tiktok|reel|reels|podcast|story|thread|newsletter|article|audience|content|film)\b/g,
  action: /\b(need to|have to|remember|don't forget|call|email|text|buy|book|schedule|tomorrow|tonight|today|monday|tuesday|wednesday|thursday|friday|weekend|deadline|pay|send|reply|fix)\b/g,
  life: /\b(health|run|running|walk|walking|gym|workout|sleep|family|mom|dad|friend|friends|habit|habits|morning|diet|meditat\w*|travel|trip|home|cook|cooking|kids|happy|stress)\b/g,
  learn: /\b(learn|learning|read|reading|book|books|course|study|studying|understand|research|skill|skills|practice|tutorial|class|teach)\b/g,
}

const clean = (s) => s.replace(FILLERS, '').replace(/\s+/g, ' ').trim()

const words = (s) => s.toLowerCase().match(/[a-z0-9']+/g) || []

export const contentWords = (s) => words(s).filter((w) => w.length > 2 && !STOP.has(w))

function segment(text) {
  const marked = text
    .replace(/([.!?])\s+/g, '$1\n')
    .replace(new RegExp(`\\s+(?=(${MARKERS})\\b)`, 'gi'), '\n')

  const pieces = []
  for (const raw of marked.split('\n')) {
    const w = raw.trim().split(/\s+/).filter(Boolean)
    // Break long unpunctuated runs (typical of speech) at a natural conjunction.
    let buf = []
    for (const word of w) {
      if (buf.length >= 14 && /^(so|but|and|then|anyway)$/i.test(word)) {
        pieces.push(buf.join(' '))
        buf = []
      }
      buf.push(word)
      if (buf.length >= 45) {
        pieces.push(buf.join(' '))
        buf = []
      }
    }
    if (buf.length) pieces.push(buf.join(' '))
  }

  // Merge fragments that are too short to stand alone into the next piece.
  const out = []
  let carry = ''
  for (const p of pieces) {
    const joined = carry ? `${carry} ${p}` : p
    if (joined.split(/\s+/).length < 5) carry = joined
    else {
      out.push(joined)
      carry = ''
    }
  }
  if (carry) out.length ? (out[out.length - 1] += ` ${carry}`) : out.push(carry)
  return out.map(clean).filter(Boolean)
}

function scoreOf(text) {
  const t = text.toLowerCase()
  let s = 0
  for (const [re, w] of TRIGGERS) if (re.test(t)) s += w
  const cw = contentWords(t)
  s += Math.min(cw.length, 10) * 0.25
  if (/\d/.test(t)) s += 0.5
  const n = t.split(/\s+/).length
  if (n < 6) s -= 2
  if (n > 50) s -= 0.5
  if (DULL.test(t)) s -= 1.5
  return s
}

const toSpark = (s) => Math.max(5, Math.min(99, Math.round(100 * (1 - Math.exp(-Math.max(s, 0) / 6)))))

function categorize(text) {
  const t = text.toLowerCase()
  let best = 'thought'
  let top = 0
  for (const [k, re] of Object.entries(LEXICON)) {
    const n = (t.match(re) || []).length
    if (n > top) {
      top = n
      best = k
    }
  }
  return best
}

const LEAD_IN =
  /^(so|and|but|okay|ok|alright|also|well|oh|anyway|right|yeah|another (thing|idea)( is)?|one more thing( is)?|the other thing( is)?|next thing( is)?|here's an idea|i was thinking( that| about)?|i've been thinking( that| about)?|i think( that)?|i feel like|i guess)\b[\s,:]*/i

function titleOf(text) {
  const t = stripLeadIns(text.replace(/[.!?]+$/, ''))
  const w = t.split(/\s+/)
  let title = w.slice(0, 11).join(' ').replace(/[,;:]+$/, '')
  if (w.length > 11) title += '…'
  return title.charAt(0).toUpperCase() + title.slice(1)
}

function tagsOf(text) {
  const seen = new Set()
  return contentWords(text)
    .filter((w) => w.length >= 4 && !seen.has(w) && seen.add(w))
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
}

function stripLeadIns(s) {
  let t = s
  for (let i = 0; i < 4; i++) {
    const next = t.replace(LEAD_IN, '')
    if (next === t) break
    t = next
  }
  return t.replace(/^(an? )?idea[:,]?\s+/i, '')
}

function sentenceCase(s) {
  const t = stripLeadIns(s).trim()
  return t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?…]$/.test(t) ? '' : '.')
}

export function similarity(a, b) {
  const A = new Set(contentWords(a))
  const B = new Set(contentWords(b))
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter)
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/**
 * Returns { ideas, repeats } where `repeats` maps existing idea ids that this
 * note mentioned again.
 */
export function extractIdeas(transcript, { noteId, existing = [] } = {}) {
  const segs = segment(transcript)
  const scored = segs.map((text) => ({ text, score: scoreOf(text) }))

  let picks = scored.filter((s) => s.score >= 3)
  if (!picks.length) {
    const fallback = [...scored].sort((a, b) => b.score - a.score)[0]
    if (fallback && fallback.text.split(/\s+/).length >= 6) picks = [fallback]
  }
  picks = picks.sort((a, b) => b.score - a.score).slice(0, 10)

  const now = Date.now()
  const ideas = []
  const repeats = []

  for (const p of picks) {
    const dupe = existing.find((e) => similarity(e.text, p.text) >= 0.5)
    if (dupe) {
      repeats.push(dupe.id)
      continue
    }
    if (ideas.some((i) => similarity(i.text, p.text) >= 0.5)) continue
    ideas.push({
      id: uid(),
      noteId,
      title: titleOf(p.text),
      text: sentenceCase(p.text),
      category: categorize(p.text),
      tags: tagsOf(p.text),
      spark: toSpark(p.score),
      best: false,
      starred: false,
      done: false,
      mentions: 1,
      createdAt: now,
    })
  }

  ideas.forEach((idea, i) => {
    idea.best = i === 0 || (i < 3 && idea.spark >= 65)
  })

  return { ideas, repeats }
}

export function wordCount(s) {
  return (s.match(/\S+/g) || []).length
}

export const DEMO_TRANSCRIPT = `okay so I'm on my walk and I was thinking um what if we built a tiny app that turns my grocery receipts into a weekly meal plan automatically that would save me like an hour every Sunday. the weather is really nice today by the way. another idea a LinkedIn post about the three mistakes I made shipping my portfolio, people love honest stories like that. I need to email Priya tomorrow about the design review and book the dentist. also I realized the real problem with my side projects is that I never charge for them, maybe I should sell the Notion template for nine dollars and see if anyone buys it. I want to read that book on habits and actually practice one habit for thirty days instead of just reading about it.`
