import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Checkbox } from '../../components/form'
import { Eyebrow } from '../../components/ui'
import { LoadingStatePanel } from '../../components/LoadingStatePanel'
import { ErrorStatePanel } from '../../components/ErrorStatePanel'

/** One specimen on the board, with its state written underneath. */
function Specimen({ caption, children, wide }: { caption: string; children: ReactNode; wide?: boolean }) {
  return (
    <figure className={`specimen ${wide ? 'specimen--wide' : ''}`}>
      <div className="specimen__body">{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

/** A component family: specimens on the left, a leader line out to the note on the right. */
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

const noop = () => {}

function LoadingPlate() {
  return (
    <Plate
      id="loading"
      component="<LoadingStatePanel>"
      title="Loading"
      note={
        <>
          <p>Shown while a request is out. The spinner turns continuously; with reduced motion turned on it holds still.</p>
          <p>Regular fills the area the content will appear in. Compact is one row, for the sidebar and cards.</p>
        </>
      }
    >
      <div className="specimen-grid specimen-grid--fields">
        <Specimen caption="Regular, default title" wide>
          <LoadingStatePanel />
        </Specimen>
        <Specimen caption="Regular, with message" wide>
          <LoadingStatePanel title="Loading notes…" message="Fetching everything filed under Databases / MariaDB." />
        </Specimen>
        <Specimen caption="Compact">
          <LoadingStatePanel size="compact" title="Loading categories…" />
        </Specimen>
        <Specimen caption="Compact, with message">
          <LoadingStatePanel size="compact" title="Saving note…" message="This only takes a moment." />
        </Specimen>
      </div>
    </Plate>
  )
}

function ErrorPlate() {
  return (
    <Plate
      id="error"
      component="<ErrorStatePanel>"
      title="Error"
      note={
        <>
          <p>Shown when a request fails. The title says what failed; the message says what the server reported.</p>
          <p>
            Reads offer Try again. Failed writes offer Dismiss. While a retry is out the button shows the spinner and the
            panel stays put, so the layout doesn't jump.
          </p>
        </>
      }
    >
      <div className="specimen-grid specimen-grid--fields">
        <Specimen caption="Regular, retry and dismiss" wide>
          <ErrorStatePanel
            title="Couldn't load notes"
            message="The server didn't respond. Check that the API is running, then try again."
            onRetry={noop}
            onDismiss={noop}
          />
        </Specimen>
        <Specimen caption="Regular, retrying" wide>
          <ErrorStatePanel title="Couldn't load notes" message="The server didn't respond." onRetry={noop} retrying />
        </Specimen>
        <Specimen caption="Regular, no actions" wide>
          <ErrorStatePanel />
        </Specimen>
        <Specimen caption="Compact, retry">
          <ErrorStatePanel size="compact" title="Couldn't load categories" onRetry={noop} />
        </Specimen>
        <Specimen caption="Compact, dismiss with message">
          <ErrorStatePanel
            size="compact"
            title="Couldn't delete note"
            message="404 Not Found: it may already be gone."
            onDismiss={noop}
          />
        </Specimen>
      </div>
    </Plate>
  )
}

type Phase = 'loading' | 'error' | 'retrying' | 'done'

function InContextPlate() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [fail, setFail] = useState(true)
  const failRef = useRef(fail)
  failRef.current = fail
  const timer = useRef<number>(undefined)

  // Stand-in for a GET request: no request is made; this only plays out the states.
  const request = (from: 'loading' | 'retrying') => {
    window.clearTimeout(timer.current)
    setPhase(from)
    timer.current = window.setTimeout(() => setPhase(failRef.current ? 'error' : 'done'), 1400)
  }

  useEffect(() => {
    request('loading')
    return () => window.clearTimeout(timer.current)
  }, [])

  const busy = phase === 'loading' || phase === 'retrying'

  return (
    <Plate
      id="in-context"
      component="Both, in sequence"
      title="A request, end to end"
      note={
        <>
          <p>Loading swaps in place for the error or the content. Try again keeps the error panel up with a busy button.</p>
          <div className="plate__switches">
            <Checkbox label="Server fails the request" checked={fail} onChange={setFail} />
            <Button onClick={() => request('loading')} disabled={busy}>
              Reload
            </Button>
          </div>
        </>
      }
    >
      <div className="state-demo">
        {phase === 'loading' && <LoadingStatePanel title="Loading notes…" />}
        {(phase === 'error' || phase === 'retrying') && (
          <ErrorStatePanel
            title="Couldn't load notes"
            message="503 Service Unavailable."
            onRetry={() => request('retrying')}
            retrying={phase === 'retrying'}
          />
        )}
        {phase === 'done' && (
          <div className="state-demo__result">
            <ul>
              <li>Create a MariaDB database and user</li>
              <li>psql cheat sheet</li>
              <li>Reverse proxy to a Node app</li>
            </ul>
          </div>
        )}
        <div className="state-demo__sidebar">
          {busy ? (
            <LoadingStatePanel size="compact" title="Loading categories…" />
          ) : phase === 'error' ? (
            <ErrorStatePanel size="compact" title="Couldn't load categories" onRetry={() => request('retrying')} />
          ) : null}
        </div>
      </div>
    </Plate>
  )
}

const SECTIONS = [
  ['loading', 'Loading'],
  ['error', 'Error'],
  ['in-context', 'In context'],
] as const

export function ApplicationStateBoard() {
  return (
    <div className="artboard artboard--single">
      <div className="artboard__main">
        <header className="artboard__head">
          <a className="artboard__back" href="/">
            Back to the app
          </a>
          <h1>Application state</h1>
          <p>
            The panels shown while the app talks to the server: one for a request in flight, one for a request that
            failed. Each appears in both sizes and every state it supports.
          </p>
          <nav className="artboard__toc" aria-label="Sections">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
        </header>

        <LoadingPlate />
        <ErrorPlate />
        <InContextPlate />
      </div>
    </div>
  )
}
