# Mock data: the API contract

These files define the REST API the backend implements (`../note-management-api`).
`src/services/notes-mock.ts` emulates it from these same files, so the UI is built against
the contract rather than against ad-hoc fixtures.

| File | What it defines |
| --- | --- |
| `models.json` | The `Category`, `Note` and `Attachment` resources: fields, types, limits, defaults. |
| `errors.json` | The error envelope and every error code, with status and user-facing message. |
| `categories/*.json`, `notes/*.json`, `attachments/*.json` | One file per call: method, path, request, responses, possible errors, and business rules. |

Conventions:

- Success bodies are wrapped in `{ "data": ... }`; lists add `{ "meta": { "total": n } }`.
- Errors are `{ "error": { "code", "message", "details"? } }`; `message` is safe to show users.
- Timestamps are ISO 8601 UTC. Ids are UUIDs. Optional values are `null`, never omitted.
- `PATCH` is a partial update; `DELETE` of a note or attachment returns `204` with no body.
- Uploads are `multipart/form-data`; file URLs in responses are relative to the API.

The `200` responses of `categories/list.json` and `notes/list.json` double as the mock
backend's seed data. Change the contract here first, then the service and the API.
