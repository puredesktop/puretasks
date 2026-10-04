# Board and mission reliability audit

The open session in `useTasksSession` is the source of truth for the current board. `App` binds it to one `.tasks` package through the shared document lifecycle. Other boards are read by `useBoardsIndex`. All changes in this audit are app-owned; the package schema, public tool names and host bridge methods are unchanged.

## Changed behavior

- Each board open owns its requested card. Older reads and failures cannot consume a newer request. Returning to the already-open board can reveal a card and cancels a pending foreign open. Successful board switches reset board-local overlays and selections, including copies with reused project/card IDs.
- A mission creation or status read cannot mutate a replacement board or an unmounted session. If creation succeeds after the original card is no longer open, the caller is told to find the created mission in Missions; no second mission is created automatically.
- Mission refreshes share one in-flight poll per board generation. Reads are deduplicated by mission ID and limited to four at a time. Editing task text does not restart the eight-second poll. Only an actual, still-current phase transition changes the board or adds terminal activity.
- Index refreshes share in-flight work, use at most four reads at a time, and stop starting stale reads after cleanup. The open board comes from memory. Other boards refresh on board-path changes, explicit Retry and the existing one-minute interval, rather than on each autosave.
- A failed index listing retains the last usable results and shows Retry in All boards. An individual unreadable board remains listed with its error. A successful retry clears the listing error.
- New task opens the returned card ID, rather than searching by a title that several cards can share. Creation failures use the existing toast. Link-editor rows are layout elements inside one form; Open and Remove cannot submit it.
- Narrow windows use a horizontal navigation rail, wrapping toolbar and board headings, fitting board cards and a single scrolling card editor.

## Development dependencies

The build pins `@swc/core` 1.16.1 with `@swc/plugin-styled-components` 13.0.0. The previous fresh installation failed with a plugin-deserialization error. SWC documents the [plugin/runtime compatibility requirement](https://swc.rs/docs/plugin/selecting-swc-core). React, React DOM and styled-components are deduplicated across local shared packages. The package declares the app's direct icon import, DOM test environment and TypeScript compiler.

Development still requires compatible shared platform packages and parent configuration, as described in [development.md](development.md). A source workspace must resolve one React type installation across the app and shared packages.

## Verification

- `npm test`: 82 tests in 14 files pass, including 27 new regression tests. Running those 27 tests against a separate copy of the original application source produces 22 failures (and the previously unhandled creation rejection).
- `npm run typecheck` and `npm run build` pass. The existing single application chunk remains about 734 kB and produces Vite's chunk-size warning; this audit does not claim to reduce bundle size.
- An isolated browser fixture uses production session and UI components, synthetic cards and memory-only board mutations. Desktop and 360-pixel layouts, duplicate-title creation, Escape close, retained boards and Retry recovery were checked. The narrow card editor has no nested forms or document-level horizontal overflow. The final fixture produced no console warnings or errors.

## Remaining integration checks

Browser fixtures and bridge mocks do not establish native filesystem persistence, cross-window writes or a paid mission's execution. Opening, saving, closing/reopening and external-write reloads in a matching desktop host remain native integration checks. Already-started bridge calls cannot be aborted by these app guards; their results are ignored once stale. Failed mission-status reads retain the last known phase and are retried by the next scheduled poll. This audit does not change the host's conflict or multi-window write policy.
