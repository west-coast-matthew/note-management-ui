# Note management

A central place for notes I keep coming back to — the exact syntax for creating a MariaDB database
and user, server config snippets, household details — organized in nested categories.

Cloned from [link-organizer-ui](../../link-organizer/link-organizer-ui): same look and feel, sidebar,
service layer, mock artboards and API-contract-first approach. What changed is the content: notes
instead of links.

## What a note is

- **Title**, required
- **Summary**, optional — shown on the card
- **Body** — formatted HTML from a rich text editor ([TipTap](https://tiptap.dev)): headings, lists,
  quotes, inline code, code blocks, links and images
- **Attachments** — any files; images get a thumbnail, everything else placeholder art for its kind
  (video, audio, PDF, text, other)
- **Created / updated** timestamps, set by the server

### Images and attachments

- Drag and drop any number of files at once: onto the editor's drop zone, anywhere on the editor form,
  onto an existing note (attaches straight to it), or anywhere on the page (starts a new note with them).
- Images dropped or pasted **into the body text** are stored in the asset directory and embedded in the
  note. Select an embedded image to put it **on its own line** or **inline with the text**. An image in the
  attachment list can be inserted into the body too.
- Hovering an image attachment shows a larger version of its thumbnail.

## Running the app

```sh
npm install
npm run dev        # http://127.0.0.1:5175
```

Mock artboards for the shared components: `/mock/form-controls/` and `/mock/application-state/`.

## Connecting to the API

- **Mock API (default).** Data comes from the JSON files in `mock-data/` and is saved in local storage.
  Uploaded files live in memory only and disappear on reload.
- **Real API.** Calls go to [note-management-api](../note-management-api), which stores files in its
  `ASSET_DIR`. Used whenever `VITE_API_BASE_URL` is set:

  ```sh
  # .env.local (ignored by git)
  VITE_API_BASE_URL=http://127.0.0.1:3002
  ```

  Restart `npm run dev` after changing it. To force the mock for one run: `VITE_API_BASE_URL= npm run dev`.

The API stores body image sources as paths relative to itself (`/api/attachments/<id>/content`); the
HTTP service resolves them against `VITE_API_BASE_URL` when loading a note and makes them relative again
when saving, so stored notes don't depend on where the API is hosted.

## Layout

```
mock-data/              API contract: one JSON file per call, plus models.json and errors.json
src/services/           contract.ts (interface), notes-http.ts (real API), notes-mock.ts, notes-queries.ts (hooks)
src/components/         NoteCard/NoteRow (library), NoteViewer, NoteEditor, RichTextEditor, attachments.tsx
src/lib/                categories, html (body helpers), files (kinds, sizes), use-uploads (bulk upload with progress)
src/mock/               design artboards served at /mock/<name>/
```
