import type {
  AppOperationExposure,
  AppOperationRisk,
} from '@purescience/platform-ui/bridge/appFunctions'

export interface AtomicToolSchemaSpec {
  name: string
  exposure: AppOperationExposure
  category: string
  risk: AppOperationRisk
  requiresApproval: boolean
  releaseButton?: string
  deletesPermanently?: boolean
  riskWhen?: Record<string, 'write' | 'destructive' | 'external' | 'release'>
  requiresCapabilities?: Array<'vision'>
  description: string
  inputSchema: Record<string, unknown> & { type: 'object' }
}

const RESOURCE_LINK_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: [
        'file',
        'writer',
        'book',
        'chapter',
        'chat-message',
        'agent-run',
      ],
      description: 'Kind of resource. Defaults to file.',
    },
    title: {
      type: 'string',
      description: 'Display title. Defaults to the path or resource id.',
    },
    path: {
      type: 'string',
      description:
        'Filesystem path of the resource, if it is a file or package.',
    },
    appSlug: {
      type: 'string',
      description: 'App that opens the resource, e.g. writer or book.',
    },
    resourceId: {
      type: 'string',
      description:
        'App-defined resource id, for resources that are not files.',
    },
  },
} as const

/**
 * All 29 atomic PureTasks tools with 3-tier exposure metadata:
 *   - "always" (7): core ~24% read/write/mission verbs + permanent-delete `deleteTaskProject`
 *     exposed directly in plugin.json.
 *   - "extended" (22): specialist board/project/column/comment/checklist/link/patch/activity
 *     tools discoverable via `discoverAppTools` and callable via `callExtendedReadTool` /
 *     `callExtendedTool` with zero loss of functionality.
 */
export const PURETASKS_ATOMIC_TOOL_SCHEMAS: readonly AtomicToolSchemaSpec[] = [
  // ── Core atomic tools (exposure: 'always') ───────────────────────────────
  {
    name: 'getTasksContext',
    exposure: 'always',
    category: 'board',
    risk: 'read',
    requiresApproval: false,
    description:
      'Call this first. Returns the open board (path, draft/filed status, project id, name, description), the current filters, view mode, the selected task id, and task counts. Every other tool resolves ids and columns against this board.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'listTasks',
    exposure: 'always',
    category: 'tasks',
    risk: 'read',
    requiresApproval: false,
    description:
      "List the cards on the open board as compact rows (no notes, checklists, or comments — use getTask for one full card). Uses the board's current filters unless overridden. Call getTasksContext first.",
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description:
            "Optional project id; must be the open board's project (from getTasksContext).",
        },
        status: {
          type: 'string',
          description: 'Optional status/column id filter, or all.',
        },
        query: {
          type: 'string',
          description: 'Optional search query override.',
        },
        label: {
          type: 'string',
          description: 'Optional label filter override.',
        },
      },
    },
  },
  {
    name: 'getTask',
    exposure: 'always',
    category: 'tasks',
    risk: 'read',
    requiresApproval: false,
    description:
      'Return one full task card, including notes, labels, links, checklists, comments, and timestamps. Defaults to the selected task when taskId is omitted; ids come from listTasks.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Optional task id. Defaults to the selected task.',
        },
      },
    },
  },
  {
    name: 'createTask',
    exposure: 'always',
    category: 'tasks',
    risk: 'write',
    requiresApproval: true,
    description:
      "Create a new task card on the open board with optional details, labels, links, owner, due date, priority, column/status, blockedBy, parentId (a subtask), estimateHours, repeat and remindAt. A column at its WIP limit refuses new cards. Call getTasksContext first; column ids come from listTaskColumns. Returns the new card's id and a compact summary (column, priority, labels, dates, counts of comments/checklists/links), not the whole card; getTask returns the full card.",
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Task title.',
        },
        projectId: {
          type: 'string',
          description:
            "Optional project id; must be the open board's project (from getTasksContext). Defaults to it.",
        },
        status: {
          type: 'string',
          description: 'Optional column/status id. Defaults to inbox.',
        },
        notes: {
          type: 'string',
          description: 'Task notes/description.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high'],
        },
        ownerName: {
          type: 'string',
        },
        labels: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        dueAt: {
          type: 'string',
          description: 'Due date as YYYY-MM-DD or ISO string.',
        },
        links: {
          type: 'array',
          items: RESOURCE_LINK_ITEM_SCHEMA,
          description:
            'Resource links to attach (the origin of the work, related files).',
        },
        blockedBy: {
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'Ids of cards this one waits on; the block clears when they are all done.',
        },
        parentId: {
          type: ['string', 'null'],
          description:
            'The card this one is a subtask of; null detaches it.',
        },
        estimateHours: {
          type: ['number', 'null'],
          minimum: 0,
        },
        loggedHours: {
          type: ['number', 'null'],
          minimum: 0,
        },
        repeat: {
          type: ['string', 'null'],
          enum: ['none', 'daily', 'weekly', 'monthly', null],
        },
        remindAt: {
          type: ['string', 'null'],
          description: 'ISO date-time for a reminder; null clears it.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'updateTask',
    exposure: 'always',
    category: 'tasks',
    risk: 'write',
    requiresApproval: true,
    description:
      "Edit, move, or reorder a task card on the open board. Call getTasksContext first. Omitted fields are preserved; status moves the card to that column (ids from listTaskColumns) and beforeTaskId places it within the column — a move into a column at its WIP limit is refused unless force is true. Also sets blockedBy (cards it waits on), parentId (subtask of), estimateHours, loggedHours, repeat (daily/weekly/monthly; a done card comes back with the next due date) and remindAt. Task ids come from listTasks. Returns the card's compact summary (id, column, order, fields, counts of comments/checklists/links), not the whole card; getTask returns the full card.",
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task id to update.',
        },
        title: {
          type: 'string',
        },
        status: {
          type: 'string',
          description: 'Move to this column/status id.',
        },
        beforeTaskId: {
          type: 'string',
          description:
            'Optional task id to place this task before within the target column.',
        },
        notes: {
          type: 'string',
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high'],
        },
        ownerName: {
          type: 'string',
        },
        labels: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        dueAt: {
          type: 'string',
        },
        links: {
          type: 'array',
          items: RESOURCE_LINK_ITEM_SCHEMA,
          description:
            "Replaces the card's resource links when given; use addTaskResourceLink/removeTaskResourceLink to change one link.",
        },
        blockedBy: {
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'Ids of cards this one waits on; the block clears when they are all done.',
        },
        parentId: {
          type: ['string', 'null'],
          description:
            'The card this one is a subtask of; null detaches it.',
        },
        estimateHours: {
          type: ['number', 'null'],
          minimum: 0,
        },
        loggedHours: {
          type: ['number', 'null'],
          minimum: 0,
        },
        repeat: {
          type: ['string', 'null'],
          enum: ['none', 'daily', 'weekly', 'monthly', null],
        },
        remindAt: {
          type: ['string', 'null'],
          description: 'ISO date-time for a reminder; null clears it.',
        },
        force: {
          type: 'boolean',
          description: 'Move into a column that is at its WIP limit anyway.',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'createMissionFromTask',
    exposure: 'always',
    category: 'missions',
    risk: 'write',
    requiresApproval: true,
    description:
      "Turn a card into an assignment the shell runs (the card's own “Create assignment” button). kind: 'do' works the task and moves it to Review, 'steps' writes a checklist only, 'draft' writes the first draft of the linked document, 'dependencies' links what the card waits on. The assignment's progress shows on the card (getTask.missions). Use when the user asks for the work to be done or planned by an assignment; never also do the work yourself. Requires approval: starts an assignment.",
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        kind: {
          type: 'string',
          enum: ['do', 'steps', 'draft', 'dependencies'],
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'deleteTaskProject',
    exposure: 'always',
    category: 'projects',
    risk: 'destructive',
    requiresApproval: true,
    deletesPermanently: true,
    description:
      'PERMANENTLY delete a board package by path (from listTaskProjects) — the folder is removed outright, with no Trash and no snapshot to restore. Call getTasksContext first. Refuses the open board; open or create another board first. Only on an explicit user instruction that names the board.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Package path of the board to delete, from listTaskProjects. Cannot be the open board.',
        },
      },
      required: ['path'],
    },
  },

  // ── Extended specialist atomic tools (exposure: 'extended') ──────────────
  {
    name: 'listTaskProjects',
    exposure: 'extended',
    category: 'projects',
    risk: 'read',
    requiresApproval: false,
    description:
      'List the boards PureTasks knows about. A project is a board is a `.tasks` package: the open board carries its projectId (the only project the write tools accept); every other board is addressed by path with openTaskProject or deleteTaskProject.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'openTaskProject',
    exposure: 'extended',
    category: 'projects',
    risk: 'read',
    requiresApproval: false,
    description:
      'Open another board (a `.tasks` package path from listTaskProjects) as the open board — the same as choosing it in the board switcher. Call getTasksContext first. The current board is saved first. Returns the opened project and its task count.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Package path of the board to open, from listTaskProjects.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'createTaskProject',
    exposure: 'extended',
    category: 'projects',
    risk: 'write',
    requiresApproval: true,
    description:
      "Create a new board (a new `.tasks` package) and make it the open board — the same as the header's New board. Tasks and columns created afterwards land on it. Returns the new project and its package path.",
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Board name; it also names the package folder.',
        },
        description: {
          type: 'string',
          description:
            'Optional one-line board description, shown under the name.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'updateTaskProject',
    exposure: 'extended',
    category: 'projects',
    risk: 'write',
    requiresApproval: true,
    description:
      'Rename or describe the open board (its project id comes from getTasksContext), or set archiveDoneAfterDays. Renaming also renames the package folder. Other boards must be opened first with openTaskProject.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description:
            "The open board's project id, from getTasksContext.",
        },
        name: {
          type: 'string',
          description: 'New board name.',
        },
        description: {
          type: 'string',
          description: 'New one-line description (empty string clears it).',
        },
        archiveDoneAfterDays: {
          type: 'integer',
          minimum: 0,
          maximum: 365,
          description:
            'Done cards leave the board after this many days (kept in the file); 0 = never.',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'listTaskColumns',
    exposure: 'extended',
    category: 'columns',
    risk: 'read',
    requiresApproval: false,
    description:
      "List the open board's columns in order, with labels and settings (collapsed, hidden, done). Column ids are the `status` values tasks carry.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'createTaskColumn',
    exposure: 'extended',
    category: 'columns',
    risk: 'write',
    requiresApproval: true,
    description:
      'Create a new board column/status on the open board. Column ids are derived from the label. Call getTasksContext first.',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Column label.',
        },
        beforeStatus: {
          type: 'string',
          description: 'Optional existing column id to insert before.',
        },
        collapsed: {
          type: 'boolean',
          description: 'Whether the column starts collapsed.',
        },
        hidden: {
          type: 'boolean',
          description: 'Whether the column starts hidden.',
        },
        done: {
          type: 'boolean',
          description: 'Whether tasks in this column count as complete.',
        },
      },
      required: ['label'],
    },
  },
  {
    name: 'updateTaskColumn',
    exposure: 'extended',
    category: 'columns',
    risk: 'write',
    requiresApproval: true,
    description:
      'Rename, reorder, hide/collapse, change done or review-queue participation, or set a WIP limit (wipLimit; 0 removes it) for a column/status on the open board. Omitted fields are preserved. Column ids come from listTaskColumns.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Column/status id to update.',
        },
        label: {
          type: 'string',
          description: 'New column label.',
        },
        beforeStatus: {
          type: ['string', 'null'],
          description:
            'Move before this column id, or null to move to the end.',
        },
        collapsed: {
          type: 'boolean',
          description: 'Set collapsed state.',
        },
        hidden: {
          type: 'boolean',
          description: 'Set hidden state.',
        },
        done: {
          type: 'boolean',
          description: 'Set whether this column counts as complete.',
        },
        review: {
          type: 'boolean',
          description:
            'Include this non-done column in the human review queue. False excludes it.',
        },
        wipLimit: {
          type: 'integer',
          minimum: 0,
          description:
            'Work-in-progress limit for the column; 0 removes it.',
        },
      },
      required: ['status'],
    },
  },
  {
    name: 'deleteTaskColumn',
    exposure: 'extended',
    category: 'columns',
    risk: 'destructive',
    requiresApproval: true,
    description:
      'Delete a custom column/status and move its tasks to another column. Inbox, Doing, Review, and Done are system columns and cannot be deleted — hide them with updateTaskColumn instead. Returns a deletedSnapshot that applyTaskBoardPatch can restore (restoreColumn).',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Column/status id to delete.',
        },
        targetStatus: {
          type: 'string',
          description: 'Column/status id that receives moved tasks.',
        },
      },
      required: ['status', 'targetStatus'],
    },
  },
  {
    name: 'deleteTask',
    exposure: 'extended',
    category: 'tasks',
    risk: 'destructive',
    requiresApproval: true,
    description:
      'Delete a task card by id (from listTasks). Returns a deletedSnapshot that applyTaskBoardPatch can restore (restoreTask).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task id to delete.',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'listTaskActivity',
    exposure: 'extended',
    category: 'activity',
    risk: 'read',
    requiresApproval: false,
    description:
      'List recent board and card activity entries on the open board, optionally scoped to one task id, sorted newest-first (limit clamped to 1-200, default 50).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Optional task id.',
        },
        limit: {
          type: 'number',
          description:
            'Maximum rows to return, clamped to 1-200. Defaults to 50.',
        },
      },
    },
  },
  {
    name: 'createTaskComment',
    exposure: 'extended',
    category: 'comments',
    risk: 'write',
    requiresApproval: true,
    description:
      'Add a progress note or decision comment to a task card on the open board (task ids come from listTasks; authorName defaults to Agent).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        text: {
          type: 'string',
        },
        authorName: {
          type: 'string',
          description: 'Optional author display name. Defaults to Agent.',
        },
      },
      required: ['taskId', 'text'],
    },
  },
  {
    name: 'updateTaskComment',
    exposure: 'extended',
    category: 'comments',
    risk: 'write',
    requiresApproval: true,
    description:
      "Edit an existing task comment's text or author name on the open board without touching other comments (comment ids come from getTask).",
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        commentId: {
          type: 'string',
        },
        text: {
          type: 'string',
        },
        authorName: {
          type: 'string',
        },
      },
      required: ['taskId', 'commentId'],
    },
  },
  {
    name: 'deleteTaskComment',
    exposure: 'extended',
    category: 'comments',
    risk: 'destructive',
    requiresApproval: true,
    description:
      'Delete a single comment from a task card on the open board without affecting the rest of the card (comment ids come from getTask).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        commentId: {
          type: 'string',
        },
      },
      required: ['taskId', 'commentId'],
    },
  },
  {
    name: 'createTaskChecklist',
    exposure: 'extended',
    category: 'checklists',
    risk: 'write',
    requiresApproval: true,
    description:
      'Create a checklist on a task card on the open board, optionally seeded with initial step items (task ids come from listTasks).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        title: {
          type: 'string',
        },
        items: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
      required: ['taskId', 'title'],
    },
  },
  {
    name: 'updateTaskChecklist',
    exposure: 'extended',
    category: 'checklists',
    risk: 'write',
    requiresApproval: true,
    description:
      'Rename a checklist on a task card on the open board while preserving its items and completion states (checklist ids come from getTask).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        checklistId: {
          type: 'string',
        },
        title: {
          type: 'string',
        },
      },
      required: ['taskId', 'checklistId'],
    },
  },
  {
    name: 'deleteTaskChecklist',
    exposure: 'extended',
    category: 'checklists',
    risk: 'destructive',
    requiresApproval: true,
    description:
      'Delete an entire checklist and all of its items from a task card on the open board (checklist ids come from getTask).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        checklistId: {
          type: 'string',
        },
      },
      required: ['taskId', 'checklistId'],
    },
  },
  {
    name: 'createTaskChecklistItem',
    exposure: 'extended',
    category: 'checklists',
    risk: 'write',
    requiresApproval: true,
    description:
      'Append a new step item to an existing checklist on a task card on the open board, optionally marked done (checklist ids come from getTask).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        checklistId: {
          type: 'string',
        },
        text: {
          type: 'string',
        },
        done: {
          type: 'boolean',
        },
      },
      required: ['taskId', 'checklistId', 'text'],
    },
  },
  {
    name: 'updateTaskChecklistItem',
    exposure: 'extended',
    category: 'checklists',
    risk: 'write',
    requiresApproval: true,
    description:
      "Edit a checklist item's text or toggle its done state on a task card on the open board without changing sibling items (item ids come from getTask).",
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        checklistId: {
          type: 'string',
        },
        itemId: {
          type: 'string',
        },
        text: {
          type: 'string',
        },
        done: {
          type: 'boolean',
        },
      },
      required: ['taskId', 'checklistId', 'itemId'],
    },
  },
  {
    name: 'deleteTaskChecklistItem',
    exposure: 'extended',
    category: 'checklists',
    risk: 'destructive',
    requiresApproval: true,
    description:
      'Delete a single item from a task checklist on the open board while preserving other items (checklist and item ids come from getTask).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        checklistId: {
          type: 'string',
        },
        itemId: {
          type: 'string',
        },
      },
      required: ['taskId', 'checklistId', 'itemId'],
    },
  },
  {
    name: 'addTaskResourceLink',
    exposure: 'extended',
    category: 'links',
    risk: 'write',
    requiresApproval: true,
    description:
      'Attach a linked file, app resource, or external reference to a task card — the origin of the work or a related document. Call getTasksContext first; task ids come from listTasks.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        link: {
          ...RESOURCE_LINK_ITEM_SCHEMA,
          description: 'Resource link to attach.',
        },
      },
      required: ['taskId', 'link'],
    },
  },
  {
    name: 'removeTaskResourceLink',
    exposure: 'extended',
    category: 'links',
    risk: 'destructive',
    requiresApproval: true,
    description:
      'Remove a single linked resource reference from a task card on the open board without affecting the underlying file (link ids come from getTask).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
        },
        linkId: {
          type: 'string',
        },
      },
      required: ['taskId', 'linkId'],
    },
  },
  {
    name: 'applyTaskBoardPatch',
    exposure: 'extended',
    category: 'board',
    risk: 'destructive',
    requiresApproval: true,
    description:
      "Apply or dry-run an ordered batch of column and task operations on the open board. Use dryRun: true first for anything broad; the result lists each operation's outcome (a card as its compact summary, never the whole card) plus a compact preview (column counts, touched task ids), never the whole board. restoreColumn and restoreTask take the deletedSnapshot payloads returned by deleteTaskColumn and deleteTask. Board-level (project) operations are not patch operations — use createTaskProject, updateTaskProject, deleteTaskProject, and openTaskProject.",
    inputSchema: {
      type: 'object',
      properties: {
        dryRun: {
          type: 'boolean',
          description:
            'If true, return a preview without persisting changes.',
        },
        reason: {
          type: 'string',
          description:
            'Short user-visible reason recorded in task activity when persisted.',
        },
        operations: {
          type: 'array',
          description:
            'Ordered patch operations. Each carries the same fields as the matching tool (createTask, updateTask, deleteTask, createColumn/updateColumn/deleteColumn mirror the column tools; comment, checklist, and link operations mirror theirs). restoreColumn and restoreTask spread a deletedSnapshot payload.',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: [
                  'createColumn',
                  'updateColumn',
                  'deleteColumn',
                  'restoreColumn',
                  'createTask',
                  'updateTask',
                  'deleteTask',
                  'restoreTask',
                  'createTaskComment',
                  'updateTaskComment',
                  'deleteTaskComment',
                  'createTaskChecklist',
                  'updateTaskChecklist',
                  'deleteTaskChecklist',
                  'createTaskChecklistItem',
                  'updateTaskChecklistItem',
                  'deleteTaskChecklistItem',
                  'addTaskResourceLink',
                  'removeTaskResourceLink',
                ],
              },
            },
            required: ['type'],
          },
        },
      },
      required: ['operations'],
    },
  },
]
