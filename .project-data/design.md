# PureTasks Product Plan

## Product Goal

PureTasks is the suite task-board workspace for project work, review queues, linked resources, checklists, comments, activity, and portable `.tasks` board packages.

## Current Product Surface

- Task board shell with main panel, board/list/calendar/files/timeline/activity views, task card modal, status stepper, and board-level document lifecycle.
- One board is one `.tasks` package containing `manifest.json` and `tasks.json`.
- Domain modules for task package IO, task model operations, agent read tools, and agent write tools.
- Agent tools for reading context, listing projects/columns/tasks/activity, reading a task, and approved create/update/delete/restore operations for projects, columns, tasks, comments, checklists, checklist items, and resource links.

## Development Notes

Task model and package behavior live in `src/lib`; board session state lives in `src/hooks`; UI views live in `src/components`; agent handlers are split by read/create/write/delete. Future work should keep task mutations in the model/agent tool layer rather than duplicating board logic in components.
