# PureTasks code review — 2026-09-10

Baseline: own remote main 84fed6f52ec70ec6aab3e1ff5f37e4c6feebfb21, freshly fetched and matched. Source of truth: suite app/bridge/document lifecycle docs and app implementation. Submodule only.

## Fixed

- Agent title/status-only edits preserve omitted owner and due date; previously both were cleared by constructing a patch with undefined own properties.
- Agent task creation in a completed column records completedAt, matching UI creation.
- Agent column completion toggles update its tasks' completion timestamps, matching the UI path.
- An explicit unknown project ID fails instead of returning the active project's tasks.
- Package reads reject invalid/future-version or multi-project content before adoption. A single-board serializer would otherwise discard additional projects on save.

## Verification

10 focused regressions passed in src/lib/codeReview.test.ts (eight failed before fixes). Valid package round trip and explicit empty-string mutation clearing remain covered. App typecheck passed. No full suite or fresh Electron run.

## Coverage and remaining work

Read task model, package serializer/parser, read tools, session mutations, App lifecycle, task/column write mutations, batch dispatcher and mutation bridge; inspected task handlers and calendar/formatting code. This was not an exhaustive rendering/style audit.

Remaining concerns:
- Normalization trusts several nested field types (labels, links, dates); malformed saved records can still break filtering/rendering. Add a repair preview before normalizing away invalid data.
- Calendar order follows board order within a status, rather than sorting all date groups chronologically.
- Restore-column snapshots can move tasks edited since deletion; validate current target status before restoring.
- Fractional task ordering eventually loses precision; reindex when adjacent ranks converge.
- Undo/restore activity and task histories have inconsistent size caps.
- Board mutations acknowledge in-memory application before lifecycle durability; persistence failures must remain visible and tool results should distinguish applied from saved.

No shell implementation changes. These focused checks do not establish full mission or UI behavior.
