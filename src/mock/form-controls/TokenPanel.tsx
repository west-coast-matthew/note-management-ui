import { useEffect, useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/**
 * Live editor for the design tokens in src/styles.css.
 * Overrides are written onto <html> as inline custom properties, so every control on the
 * board (and anything else using the tokens) updates immediately. styles.css stays the
 * source of truth: "Copy CSS" gives you the changed values to paste back into it.
 */

type Token =
  | { name: string; label: string; kind: 'color' }
  | { name: string; label: string; kind: 'length'; min: number; max: number }
  | { name: string; label: string; kind: 'font'; options: string[] }

const GROUPS: { title: string; tokens: Token[] }[] = [
  {
    title: 'Color',
    tokens: [
      { name: '--accent', label: 'Accent', kind: 'color' },
      { name: '--kind-video', label: 'Video files', kind: 'color' },
      { name: '--kind-audio', label: 'Audio files', kind: 'color' },
      { name: '--kind-text', label: 'Text files', kind: 'color' },
      { name: '--bg', label: 'Canvas', kind: 'color' },
      { name: '--surface', label: 'Surface', kind: 'color' },
      { name: '--surface-2', label: 'Raised surface', kind: 'color' },
      { name: '--surface-3', label: 'Inset surface', kind: 'color' },
      { name: '--border', label: 'Border', kind: 'color' },
      { name: '--text', label: 'Text', kind: 'color' },
      { name: '--text-2', label: 'Secondary text', kind: 'color' },
    ],
  },
  {
    title: 'Shape',
    tokens: [
      { name: '--control-h', label: 'Control height', kind: 'length', min: 32, max: 56 },
      { name: '--radius-sm', label: 'Control radius', kind: 'length', min: 0, max: 20 },
      { name: '--radius', label: 'Card radius', kind: 'length', min: 0, max: 28 },
    ],
  },
  {
    title: 'Type',
    tokens: [
      {
        name: '--font',
        label: 'Text face',
        kind: 'font',
        options: ['Geist', 'Instrument Sans', 'IBM Plex Sans', 'Space Grotesk'],
      },
      {
        name: '--mono',
        label: 'Label face',
        kind: 'font',
        options: ['Geist Mono', 'JetBrains Mono', 'IBM Plex Mono'],
      },
    ],
  },
]

const ALL = GROUPS.flatMap((g) => g.tokens)
const STORAGE_KEY = 'note-management:mock-tokens'
const FALLBACK = { '--font': 'ui-sans-serif, system-ui, sans-serif', '--mono': 'ui-monospace, monospace' } as Record<string, string>

const fontValue = (family: string, name: string) => `'${family}', ${FALLBACK[name]}`
const firstFamily = (value: string) => value.split(',')[0].trim().replace(/^['"]|['"]$/g, '')

function readStored(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function TokenPanel() {
  const [defaults, setDefaults] = useState<Record<string, string>>({})
  const [overrides, setOverrides] = useState<Record<string, string>>(readStored)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(true)

  // Read the stylesheet's values once, before any overrides are applied.
  useLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement)
    setDefaults(Object.fromEntries(ALL.map((t) => [t.name, style.getPropertyValue(t.name).trim()])))
  }, [])

  useEffect(() => {
    const root = document.documentElement
    for (const t of ALL) {
      if (overrides[t.name]) root.style.setProperty(t.name, overrides[t.name])
      else root.style.removeProperty(t.name)
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
    } catch {
      /* storage unavailable — tweaks last for this visit only */
    }
  }, [overrides])

  const set = (name: string, value: string) =>
    setOverrides((prev) => {
      const next = { ...prev }
      if (value === defaults[name]) delete next[name]
      else next[name] = value
      return next
    })

  const changed = Object.keys(overrides)
  const css = `:root {\n${changed.map((n) => `  ${n}: ${overrides[n]};`).join('\n')}\n}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(css)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — the CSS is still visible in the panel */
    }
  }

  const valueOf = (name: string) => overrides[name] ?? defaults[name] ?? ''

  return (
    <aside className={`tweaks ${open ? '' : 'is-collapsed'}`} aria-label="Tweaks">
      <header className="tweaks__head">
        <h2>Tweaks</h2>
        <span className="tweaks__count">{changed.length ? `${changed.length} changed` : 'Matches styles.css'}</span>
        <button type="button" className="tweaks__collapse" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </header>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="tweaks__body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {GROUPS.map((g) => (
              <section key={g.title} className="tweaks__group">
                <h3>{g.title}</h3>
                {g.tokens.map((t) => {
                  const value = valueOf(t.name)
                  const isChanged = t.name in overrides
                  return (
                    <label key={t.name} className={`tweak ${isChanged ? 'is-changed' : ''}`}>
                      <span className="tweak__label">
                        {t.label}
                        <code>{t.name}</code>
                      </span>
                      {t.kind === 'color' && (
                        <span className="tweak__color">
                          <input type="color" value={toHex(value)} onChange={(e) => set(t.name, e.target.value)} />
                          <span>{toHex(value)}</span>
                        </span>
                      )}
                      {t.kind === 'length' && (
                        <span className="tweak__range">
                          <input
                            type="range"
                            min={t.min}
                            max={t.max}
                            value={parseFloat(value) || 0}
                            onChange={(e) => set(t.name, `${e.target.value}px`)}
                          />
                          <span>{value}</span>
                        </span>
                      )}
                      {t.kind === 'font' && (
                        <select value={firstFamily(value)} onChange={(e) => set(t.name, fontValue(e.target.value, t.name))}>
                          {t.options.map((f) => (
                            <option key={f}>{f}</option>
                          ))}
                        </select>
                      )}
                    </label>
                  )
                })}
              </section>
            ))}

            <section className="tweaks__group">
              <h3>Export</h3>
              <pre className="tweaks__css">{changed.length ? css : 'No changes yet. Adjust a token above.'}</pre>
              <div className="tweaks__actions">
                <button type="button" className="btn btn--primary mono" onClick={copy} disabled={!changed.length}>
                  {copied ? 'Copied' : 'Copy CSS'}
                </button>
                <button type="button" className="btn btn--ghost mono" onClick={() => setOverrides({})} disabled={!changed.length}>
                  Reset
                </button>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}

/** <input type=color> only accepts #rrggbb. */
function toHex(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(value)) return '#' + [...value.slice(1)].map((c) => c + c).join('').toLowerCase()
  const m = value.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/)
  if (m) return '#' + m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')
  return '#000000'
}
