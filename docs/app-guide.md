# puretasks app guide

A task workspace for organizing project work, tracking status, and reviewing queues. Save boards, update task details, and connect tasks to relevant resources in the suite.

## Workspace layout

| Area | What you use it for |
| --- | --- |
| **Navigation rail** | Choose a board or work queue and return to available boards. |
| **Task workspace** | Review the tasks in the selected board or queue. |
| **Task details** | Inspect and edit a task’s fields, owner, status, and linked context. |
| **Status and review controls** | Move work through its stages and review what needs attention. |

## Working with puretasks

1. Create a task board and add the work you want to track.
2. Update task details and status as work progresses, and link relevant resources.
3. Review queues regularly and save the editable board as a `.tasks` document.

## Development and loading

We welcome **developers and vibecoders alike**. [Create a developer account on puredesktop.ai](https://puredesktop.ai/developers), then use Claude Code, Codex, your own editor, or purefactory to develop this app or create a new one.

The [development guide](development.md) covers preparing this repository's shared dependencies, starting a coding agent, adding features in purefactory, and checking the result in the desktop. It includes the commands available in this repository.

Use **Open folder** in purefactory to edit a project externally, and **Open app** to test it. Use **Share** to create a `.pureapp` package, then **Settings → System → Install an app → Choose package…** in current builds to install it. Older versions may provide **File → Install App…**. A development server URL alone does not install an app.

To extend this app in purefactory, select its editable project when available. Source development builds can expose the suite's own apps; packaged installations do not expose every built-in app's source. See [create or extend an app](development.md#create-or-extend-an-app-with-purefactory) for that distinction and the app drawer workflow.

## Source layout

| Path | Purpose |
| --- | --- |
| [plugin.json](../plugin.json) | App identity, entry point, permissions, supported documents, and agent-tool declarations. |
| [package.json](../package.json) | Dependencies and development, build, and validation scripts. |
| [src/App.tsx](../src/App.tsx) | App entry and workspace composition. |
| [src/components](../src/components) | Workspace views, panels, and controls. |
| [src/hooks](../src/hooks) | Boot, state, and interaction hooks. |
| [src/lib](../src/lib) | App data models, document handling, and domain logic. |
| [src/agents](../src/agents) | Agent-tool declarations and handlers. |
| [src/bridge](../src/bridge) | Integration with the desktop’s services. |
| [agents.md](../agents.md) | Instructions and capabilities for the app’s agent. |
| [docs](../docs) | Usage and technical documentation. |

## Developer accounts and the marketplace

We welcome **developers and vibecoders alike**. Go to [puredesktop.ai](https://puredesktop.ai) and [create a developer account](https://puredesktop.ai/developers) to join the developer community and submit your app for review.

Bring improvements to this app, develop a fork, or build something entirely new. We welcome **open-source and proprietary projects alike** to the [puredesktop](https://puredesktop.ai) marketplace. Support for **paid apps is coming soon**, so you will be able to charge for your apps if you choose. Forks and redistributed dependencies must follow their applicable licenses.

For developer access, app submissions, or marketplace questions, contact [info@puredesktop.ai](mailto:info@puredesktop.ai).

## Contributing

We welcome pull requests, bug reports, new features, and documentation improvements. You may modify and distribute this app under its applicable licenses. See [CONTRIBUTING.md](../CONTRIBUTING.md), [LICENSE](../LICENSE), and [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Everyday boards, Today and Review

Boards are the main workspace for any kind of work: projects, errands, maintenance,
writing or team planning. Owners, dates and assignments are optional. Rename and
reorder columns, add your own stages, and keep using board, list, calendar or timeline
views with the same cards and saved filters.

- **Quick capture:** press **N** or **+ Task**, enter a title and press Enter. The form
  names the current board and its Inbox column. Cancel leaves no placeholder card.
  A full column refuses the addition and keeps your draft.
- **Today:** choose cards across boards, including undated and unassigned work.
  These choices are separate from deadlines and never reschedule a task. Today
  includes all owners; it is not an inferred personal assignment filter.
- **Review:** the system Review column participates by default. Each non-done
  column's menu can include or exclude it, so custom approval stages work too.
  The Personal template's Someday column stays a backlog, including boards with
  the original four-column Personal layout. Renaming a review column preserves
  its participation. A done column never appears in the review queue.
- **Review decisions:** open a card to read the brief, latest comment and linked
  work. Accept marks it done. Request changes records feedback and returns it to
  Doing (or another non-review work column). The note and move save together;
  WIP limits apply. This works without an agent or meeting.

Cards on another board offer **Open card** or **Review card**. Opening loads their
own board through the normal document lifecycle before any edits. Failed board
reads are shown in the cross-board views with Retry.

## Local experience preview

Run `npm run dev -- --port 5618` and visit `/dev/preview.html`. This development-only
adapter runs the real App and document lifecycle with fictional workshop and home
boards. Changes persist in browser session storage; Reset examples restores the
fixtures. Narrow window checks the layout at 390px. There are no external file,
assignment or app writes, and this adapter is not included in the production build.
