import { useCallback, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Attachment, AttachmentKind, Category, NoteDraft } from '../../types'
import { Button, Checkbox, SelectField, TextArea, TextField } from '../../components/form'
import { NoteEditor } from '../../components/NoteEditor'
import { AttachmentArt, AttachmentStrip, AttachmentTile, Dropzone, PendingTile } from '../../components/attachments'
import { categoryOptions } from '../../lib/categories'
import { Eyebrow, Icon, Toggle } from '../../components/ui'
import { TokenPanel } from './TokenPanel'
import categoriesList from '../../../mock-data/categories/list.json'

/* Categories straight from the API contract's seed data; the artboard never calls the service. */
const CATEGORIES = categoriesList.responses[0].body.data as Category[]
const MARIADB_ID = CATEGORIES.find((c) => c.name === 'MariaDB')!.id
const DOCKER_ID = CATEGORIES.find((c) => c.name === 'Docker')!.id
const OPTIONS = [{ value: '', label: 'Unsorted' }, ...categoryOptions(CATEGORIES)]

/** One specimen on the board, with its state written underneath. */
function Specimen({ caption, children, wide }: { caption: string; children: ReactNode; wide?: boolean }) {
  return (
    <figure className={`specimen ${wide ? 'specimen--wide' : ''}`}>
      <div className="specimen__body">{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

/** A control family: specimens on the left, a leader line out to the note on the right. */
function Plate({
  id,
  component,
  title,
  note,
  children,
}: {
  id: string
  component: string
  title: string
  note: ReactNode
  children: ReactNode
}) {
  return (
    <section className="plate" id={id} aria-labelledby={`${id}-title`}>
      <div className="plate__stage">{children}</div>
      <aside className="plate__note">
        <Eyebrow>{component}</Eyebrow>
        <h2 id={`${id}-title`}>{title}</h2>
        <div className="plate__copy">{note}</div>
      </aside>
    </section>
  )
}

function ButtonsPlate() {
  const variants = ['primary', 'ghost', 'dashed'] as const
  return (
    <Plate
      id="buttons"
      component="<Button>"
      title="Buttons"
      note={
        <>
          <p>Primary is for the single action that saves. Everything else is ghost; dashed is for “create something new” in lists.</p>
          <p>Saving replaces the icon with a spinner and blocks repeat clicks while the request is out.</p>
        </>
      }
    >
      <div className="specimen-grid specimen-grid--buttons">
        {variants.map((v) => (
          <div className="specimen-row" key={v}>
            <span className="specimen-row__name">{v[0].toUpperCase() + v.slice(1)}</span>
            <Specimen caption="Rest">
              <Button variant={v}>Save note</Button>
            </Specimen>
            <Specimen caption="Hover">
              <Button variant={v} forceState="hover">
                Save note
              </Button>
            </Specimen>
            <Specimen caption="Focus">
              <Button variant={v} forceState="focus">
                Save note
              </Button>
            </Specimen>
            <Specimen caption="Disabled">
              <Button variant={v} disabled>
                Save note
              </Button>
            </Specimen>
            <Specimen caption="Saving">
              <Button variant={v} loading>
                Saving…
              </Button>
            </Specimen>
          </div>
        ))}
        <div className="specimen-row">
          <span className="specimen-row__name">Large</span>
          <Specimen caption="With icon" wide>
            <Button variant="primary" size="lg" icon={<Icon name="plus" size={16} />}>
              New note
            </Button>
          </Specimen>
          <Specimen caption="Secondary, with icon" wide>
            <Button icon={<Icon name="edit" size={14} />}>Edit</Button>
          </Specimen>
        </div>
      </div>
    </Plate>
  )
}

function TextPlate() {
  const [value, setValue] = useState('Create a MariaDB database and user')
  return (
    <Plate
      id="text"
      component="<TextField>"
      title="Text fields"
      note={
        <>
          <p>Focus swaps the border to a dashed accent line, borrowed from the annotation frames in the reference.</p>
          <p>Errors say what to type, not what went wrong. They sit directly under the field and are announced to screen readers.</p>
        </>
      }
    >
      <div className="specimen-grid specimen-grid--fields">
        <Specimen caption="Empty">
          <TextField label="Title" placeholder="What is this about?" />
        </Specimen>
        <Specimen caption="Filled">
          <TextField label="Title" value={value} onChange={(e) => setValue(e.target.value)} />
        </Specimen>
        <Specimen caption="Focus">
          <TextField label="Title" forceState="focus" defaultValue="psql cheat sheet" />
        </Specimen>
        <Specimen caption="Error">
          <TextField label="Title" defaultValue="" error="Add a title so you can find this note later" />
        </Specimen>
        <Specimen caption="Hint">
          <TextField label="Title" placeholder="What is this about?" hint="Shown on the card and used by search." />
        </Specimen>
        <Specimen caption="Disabled">
          <TextField label="Title" disabled defaultValue="Reverse proxy to a Node app" />
        </Specimen>
        <Specimen caption="Search, with prefix" wide>
          <TextField label="Search" placeholder="Search notes and files…" prefix={<Icon name="search" />} />
        </Specimen>
      </div>
    </Plate>
  )
}

function LongFormPlate() {
  const [cat, setCat] = useState(MARIADB_ID)
  return (
    <Plate
      id="longform"
      component="<TextArea> · <SelectField>"
      title="Summary and category"
      note={
        <p>
          The category list is the tree flattened in order, with subcategories indented under their parent, so a note can be
          filed at any depth.
        </p>
      }
    >
      <div className="specimen-grid specimen-grid--fields">
        <Specimen caption="Summary, empty">
          <TextArea label="Summary" optional rows={2} placeholder="One or two lines shown on the card…" />
        </Specimen>
        <Specimen caption="Summary, focus">
          <TextArea label="Summary" optional rows={2} forceState="focus" defaultValue="CREATE DATABASE, CREATE USER, then GRANT — in that order." />
        </Specimen>
        <Specimen caption="Category">
          <SelectField label="Category" value={cat} onChange={(e) => setCat(e.target.value)} options={OPTIONS} />
        </Specimen>
        <Specimen caption="Category, focus">
          <SelectField label="Category" forceState="focus" defaultValue={DOCKER_ID} options={OPTIONS} />
        </Specimen>
      </div>
    </Plate>
  )
}

/* A generated stand-in image, so the hover preview has something to show without a server. */
const SAMPLE_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b2a20"/><stop offset="1" stop-color="#e8401c"/></linearGradient></defs><rect width="640" height="400" fill="url(#g)"/><g fill="none" stroke="#f3ece8" stroke-opacity=".55" stroke-width="3"><rect x="70" y="70" width="500" height="260" rx="14"/><path d="M70 130h500M130 180h220M130 225h300M130 270h160"/></g></svg>`,
  )

const sample = (kind: AttachmentKind, fileName: string, size: number, extra: Partial<Attachment> = {}): Attachment => ({
  id: `sample-${fileName}`,
  noteId: null,
  fileName,
  mimeType: '',
  size,
  kind,
  embedded: false,
  width: null,
  height: null,
  url: '#',
  thumbnailUrl: null,
  createdAt: new Date().toISOString(),
  ...extra,
})

const SAMPLES: Attachment[] = [
  sample('image', 'grants-diagram.png', 184_213, { thumbnailUrl: SAMPLE_IMAGE, url: SAMPLE_IMAGE, width: 1280, height: 800 }),
  sample('video', 'failover-demo.mp4', 48_234_112),
  sample('audio', 'standup-notes.m4a', 3_802_221),
  sample('pdf', 'mariadb-security.pdf', 1_048_576),
  sample('text', 'my.cnf', 2_310),
  sample('other', 'backup.tar.gz', 734_003_200),
]

function AttachmentsPlate() {
  const [dropped, setDropped] = useState<string[]>([])
  return (
    <Plate
      id="attachments"
      component="<AttachmentTile> · <Dropzone>"
      title="Attachments"
      note={
        <>
          <p>Images show their thumbnail; hover one to see it larger. Every other kind gets placeholder art tinted by kind, with the file's extension.</p>
          <p>The drop zone takes any number of files at once. Each file uploads on its own with its own progress bar, so one failure doesn't stop the rest.</p>
        </>
      }
    >
      <div className="specimen-grid specimen-grid--fields">
        <Specimen caption="Placeholder art, by kind" wide>
          <div className="art-row">
            {(['image', 'video', 'audio', 'pdf', 'text', 'other'] as const).map((k) => (
              <AttachmentArt key={k} kind={k} fileName={`sample.${{ image: 'heic', video: 'mov', audio: 'mp3', pdf: 'pdf', text: 'sql', other: 'zip' }[k]}`} size="lg" />
            ))}
          </div>
        </Specimen>
        <Specimen caption="Tiles: hover the image for a preview" wide>
          <ul className="att-grid">
            {SAMPLES.map((a) => (
              <AttachmentTile key={a.id} attachment={a} onRemove={() => {}} onInsert={a.kind === 'image' ? () => {} : undefined} />
            ))}
          </ul>
        </Specimen>
        <Specimen caption="Uploading and failed">
          <ul className="att-grid att-grid--single">
            <PendingTile upload={{ key: 'a', fileName: 'schema-dump.sql', size: 4_200_000, kind: 'text', progress: 0.62 }} />
            <PendingTile upload={{ key: 'b', fileName: 'screen-recording.mov', size: 900_000_000, kind: 'video', progress: 0, error: 'That file is too large to upload.' }} onDismiss={() => {}} />
          </ul>
        </Specimen>
        <Specimen caption="Card strip">
          <AttachmentStrip attachments={SAMPLES} max={4} />
        </Specimen>
        <Specimen caption="Drop zone" wide>
          <Dropzone onFiles={(files) => setDropped(files.map((f) => f.name))} />
          {dropped.length > 0 && <p className="plate__result mono">Received: {dropped.join(', ')}</p>}
        </Specimen>
        <Specimen caption="Drop zone, compact (once files are attached)" wide>
          <Dropzone compact onFiles={(files) => setDropped(files.map((f) => f.name))} title="Drop files to attach" />
        </Specimen>
      </div>
    </Plate>
  )
}

function ChoicePlate() {
  const [sort, setSort] = useState<'updated' | 'created'>('updated')
  const [a, setA] = useState(true)
  const [b, setB] = useState(false)
  return (
    <Plate
      id="choices"
      component="<Toggle> · <Checkbox>"
      title="Toggles and checkboxes"
      note={
        <p>
          The toggle is for a choice between two views of the same list. Checkboxes are for independent on/off settings;
          the check draws in so the change is visible.
        </p>
      }
    >
      <div className="specimen-grid specimen-grid--fields">
        <Specimen caption="Sort toggle" wide>
          <Toggle
            left={{ value: 'updated', label: 'Updated' }}
            right={{ value: 'created', label: 'Created' }}
            value={sort}
            onChange={setSort}
          />
        </Specimen>
        <Specimen caption="Checked">
          <Checkbox label="Open attachments in a new tab" checked={a} onChange={setA} />
        </Specimen>
        <Specimen caption="Unchecked">
          <Checkbox label="Show empty notes" checked={b} onChange={setB} />
        </Specimen>
        <Specimen caption="Focus">
          <Checkbox label="Show empty notes" checked={false} forceState="focus" />
        </Specimen>
        <Specimen caption="Disabled">
          <Checkbox label="Sync with server" checked={false} disabled />
        </Specimen>
        <Specimen caption="Chip">
          <span className="chip">
            <Icon name="paperclip" size={12} /> 3 files
          </span>
        </Specimen>
      </div>
    </Plate>
  )
}

type Outcome = { kind: 'saved'; at: string } | null

function ComposedPlate() {
  const [draft, setDraft] = useState<NoteDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string>()
  const [failNext, setFailNext] = useState(false)
  const [slow, setSlow] = useState(true)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [formKey, setFormKey] = useState(0)
  const timer = useRef<number>(undefined)

  const onDraftChange = useCallback((d: NoteDraft) => setDraft(d), [])

  // Stand-in for the REST call: no request is made; this only plays out the states.
  const save = () => {
    setServerError(undefined)
    setOutcome(null)
    setSaving(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(
      () => {
        setSaving(false)
        if (failNext) setServerError('Some fields need attention. The note body is too large. Move big images into attachments.')
        else setOutcome({ kind: 'saved', at: new Date().toLocaleTimeString() })
      },
      slow ? 1400 : 250,
    )
  }

  const reset = () => {
    window.clearTimeout(timer.current)
    setSaving(false)
    setServerError(undefined)
    setOutcome(null)
    setFormKey((k) => k + 1)
  }

  return (
    <Plate
      id="composed"
      component="<NoteEditor>"
      title="Write a note, end to end"
      note={
        <>
          <p>The real form, built from the controls above. Save it to walk through the request states.</p>
          <p>
            The panel beside it shows the body the form would send. Files dropped here stay in the browser: the artboard
            uses whichever API the app is configured for, so uploads are real when VITE_API_BASE_URL is set.
          </p>
          <div className="plate__switches">
            <Checkbox label="Slow network" checked={slow} onChange={setSlow} />
            <Checkbox label="Server rejects the save" checked={failNext} onChange={setFailNext} />
          </div>
        </>
      }
    >
      <div className="composed">
        <NoteEditor
          key={formKey}
          inline
          categories={CATEGORIES}
          defaultCategoryId={MARIADB_ID}
          initial={undefined}
          onSave={save}
          onClose={reset}
          saving={saving}
          serverError={serverError}
          onDraftChange={onDraftChange}
        />
        <div className="request">
          <div className="request__line">
            <span className="request__method">POST</span>
            <code>/api/notes</code>
            <span className={`request__status ${saving ? 'is-pending' : serverError ? 'is-error' : outcome ? 'is-ok' : ''}`}>
              {saving ? 'Pending' : serverError ? '400 Bad Request' : outcome ? '201 Created' : 'Not sent'}
            </span>
          </div>
          <pre className="request__body">{draft ? JSON.stringify(draft, (k, v) => (k === 'body' && typeof v === 'string' && v.length > 400 ? `${v.slice(0, 400)}…` : v), 2) : '{}'}</pre>
          <AnimatePresence>
            {outcome && (
              <motion.p className="request__note" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                Saved at {outcome.at}. In the app the editor would close and the note would open in the reading view.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Plate>
  )
}

const SECTIONS = [
  ['buttons', 'Buttons'],
  ['text', 'Text fields'],
  ['longform', 'Summary and category'],
  ['attachments', 'Attachments'],
  ['choices', 'Toggles and checkboxes'],
  ['composed', 'Write a note'],
] as const

export function FormControlsBoard() {
  return (
    <div className="artboard">
      <div className="artboard__main">
        <header className="artboard__head">
          <a className="artboard__back" href="/">
            Back to the app
          </a>
          <h1>Form controls</h1>
          <p>
            Every control used to write and edit notes, in each of its states. Adjust the tokens in Tweaks to try a new look
            here; when you like it, Copy CSS gives you the values to paste into <code>src/styles.css</code> so the app picks
            them up.
          </p>
          <nav className="artboard__toc" aria-label="Sections">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
        </header>

        <ButtonsPlate />
        <TextPlate />
        <LongFormPlate />
        <AttachmentsPlate />
        <ChoicePlate />
        <ComposedPlate />
      </div>
      <TokenPanel />
    </div>
  )
}
