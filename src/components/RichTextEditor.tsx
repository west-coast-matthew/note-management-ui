import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extension-placeholder'
import type { Attachment } from '../types'
import { kindOf } from '../lib/files'
import { Spinner } from './form'
import { Icon, type IconName } from './ui'

/**
 * Images in a note body. Each one is either a block (on its own line, full width) or
 * inline (sits in the line of text, small). Under the hood every image is an inline
 * node; `display` decides how it's laid out, so switching never moves it.
 */
const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      display: {
        default: 'block',
        parseHTML: (el) => (el.getAttribute('data-display') === 'inline' ? 'inline' : 'block'),
        renderHTML: (attrs) => ({ 'data-display': attrs.display }),
      },
      attachmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-attachment-id'),
        renderHTML: (attrs) => (attrs.attachmentId ? { 'data-attachment-id': attrs.attachmentId } : {}),
      },
    }
  },
}).configure({ inline: true, allowBase64: true })

export type ImageDisplay = 'block' | 'inline'

const extensions = (placeholder: string, editable: boolean) => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: !editable, autolink: true, defaultProtocol: 'https', HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } },
  }),
  NoteImage,
  Placeholder.configure({ placeholder }),
]

export interface RichTextEditorHandle {
  /** Put stored images into the body at the cursor. */
  insertImages: (attachments: Attachment[], display?: ImageDisplay) => void
  focus: () => void
}

interface Props {
  /** Initial HTML. Later changes to it are ignored; the editor owns the content once mounted. */
  initialHtml: string
  onChange: (html: string) => void
  /** Upload images pasted or dropped into the body (embedded uploads). Resolves with what was stored. */
  onUploadImages: (files: File[]) => Promise<Attachment[]>
  /** Files dropped into the body that aren't images go to the attachment list instead. */
  onAttachFiles: (files: File[]) => void
  /** True while body images are uploading. */
  uploading?: boolean
  placeholder?: string
  disabled?: boolean
  ref?: Ref<RichTextEditorHandle>
}

const imageNodes = (attachments: Attachment[], display: ImageDisplay) =>
  attachments.map((a) => ({ type: 'image', attrs: { src: a.url, alt: a.fileName, attachmentId: a.id, display } }))

/** Splits dropped/pasted files into images (for the body) and everything else (attachments). */
const splitFiles = (files: File[]) => ({
  images: files.filter((f) => kindOf(f.type, f.name) === 'image'),
  others: files.filter((f) => kindOf(f.type, f.name) !== 'image'),
})

export function RichTextEditor({ initialHtml, onChange, onUploadImages, onAttachFiles, uploading, placeholder = 'Write the note…', disabled, ref }: Props) {
  // Handlers change every render; the editor is created once, so it reads them through a ref.
  const handlers = useRef({ onChange, onUploadImages, onAttachFiles })
  handlers.current = { onChange, onUploadImages, onAttachFiles }

  const placeFiles = async (editor: Editor, files: File[], pos?: number) => {
    const { images, others } = splitFiles(files)
    if (others.length) handlers.current.onAttachFiles(others)
    if (!images.length) return
    const stored = await handlers.current.onUploadImages(images)
    if (!stored.length || editor.isDestroyed) return
    const at = pos === undefined ? editor.state.selection.to : Math.min(pos, editor.state.doc.content.size)
    editor.chain().focus().insertContentAt(at, imageNodes(stored, 'block')).run()
  }

  const editor = useEditor({
    extensions: extensions(placeholder, true),
    content: initialHtml,
    shouldRerenderOnTransaction: true,
    immediatelyRender: true,
    onUpdate: ({ editor }) => handlers.current.onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'prose prose--editor', 'aria-label': 'Note body', 'aria-multiline': 'true', role: 'textbox' },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])]
        if (!files.length || !editor) return false
        event.preventDefault()
        void placeFiles(editor, files)
        return true
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = [...(event.dataTransfer?.files ?? [])]
        if (moved || !files.length || !editor) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        void placeFiles(editor, files, pos)
        return true
      },
    },
  })

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  useImperativeHandle(
    ref,
    () => ({
      insertImages: (attachments, display = 'block') => {
        editor?.chain().focus().insertContent(imageNodes(attachments, display)).run()
      },
      focus: () => editor?.commands.focus(),
    }),
    [editor],
  )

  const fileInput = useRef<HTMLInputElement>(null)
  if (!editor) return null

  const selectedImage =
    editor.state.selection instanceof NodeSelection && editor.state.selection.node.type.name === 'image' ? editor.state.selection.node : null
  const display = selectedImage?.attrs.display as ImageDisplay | undefined

  const tool = (icon: IconName | string, label: string, run: () => void, active = false, enabled = true) => (
    <button
      key={label}
      type="button"
      className={`rte__btn ${active ? 'is-active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled || !enabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {icon.length <= 2 ? <span className="rte__glyph mono">{icon}</span> : <Icon name={icon as IconName} size={16} />}
    </button>
  )
  const c = () => editor.chain().focus()

  const setLink = () => {
    const previous = (editor.getAttributes('link').href as string | undefined) ?? ''
    const url = window.prompt('Link address (leave empty to remove the link)', previous || 'https://')
    if (url === null) return
    if (!url.trim() || url.trim() === 'https://') c().extendMarkRange('link').unsetLink().run()
    else c().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div className={`rte ${disabled ? 'is-disabled' : ''}`}>
      <div className="rte__toolbar" role="toolbar" aria-label="Formatting">
        <div className="rte__group">
          {tool('bold', 'Bold', () => c().toggleBold().run(), editor.isActive('bold'))}
          {tool('italic', 'Italic', () => c().toggleItalic().run(), editor.isActive('italic'))}
          {tool('underline', 'Underline', () => c().toggleUnderline().run(), editor.isActive('underline'))}
          {tool('strike', 'Strikethrough', () => c().toggleStrike().run(), editor.isActive('strike'))}
          {tool('code', 'Inline code', () => c().toggleCode().run(), editor.isActive('code'))}
          {tool('link', 'Link', setLink, editor.isActive('link'))}
        </div>
        <div className="rte__group">
          {tool('H1', 'Heading 1', () => c().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
          {tool('H2', 'Heading 2', () => c().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
          {tool('H3', 'Heading 3', () => c().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
        </div>
        <div className="rte__group">
          {tool('list', 'Bulleted list', () => c().toggleBulletList().run(), editor.isActive('bulletList'))}
          {tool('orderedList', 'Numbered list', () => c().toggleOrderedList().run(), editor.isActive('orderedList'))}
          {tool('quote', 'Quote', () => c().toggleBlockquote().run(), editor.isActive('blockquote'))}
          {tool('codeBlock', 'Code block', () => c().toggleCodeBlock().run(), editor.isActive('codeBlock'))}
          {tool('rule', 'Divider', () => c().setHorizontalRule().run())}
        </div>
        <div className="rte__group">
          {tool('image', 'Insert image', () => fileInput.current?.click())}
          {tool('imageBlock', 'Image on its own line', () => c().updateAttributes('image', { display: 'block' }).run(), display === 'block', !!selectedImage)}
          {tool('imageInline', 'Image inline with text', () => c().updateAttributes('image', { display: 'inline' }).run(), display === 'inline', !!selectedImage)}
        </div>
        <div className="rte__group rte__group--end">
          {uploading && (
            <span className="rte__status mono" role="status">
              <Spinner size={13} /> Uploading
            </span>
          )}
          {tool('undo', 'Undo', () => c().undo().run(), false, editor.can().undo())}
          {tool('redo', 'Redo', () => c().redo().run(), false, editor.can().redo())}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) void placeFiles(editor, files)
          }}
        />
      </div>
      <EditorContent editor={editor} className="rte__content" />
    </div>
  )
}

/** Read-only rendering of a note body, through the same schema as the editor. */
export function NoteBody({ html }: { html: string }) {
  const editor = useEditor({
    extensions: extensions('', false),
    content: html,
    editable: false,
    immediatelyRender: true,
    editorProps: { attributes: { class: 'prose' } },
  })
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.getHTML() !== html) editor.commands.setContent(html, { emitUpdate: false })
  }, [editor, html])
  return <EditorContent editor={editor} />
}
