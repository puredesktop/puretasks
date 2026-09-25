import { useEffect, useId, useState } from 'react'
import {
  AlignLeft,
  Check,
  ChevronRight,
  Info,
  Link2,
  ListChecks,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { PlatformIcon } from '@purescience/platform-ui/components/chrome/PlatformIcon'
import { Button } from '@purescience/platform-ui/components/common/buttons/Button'
import { Badge } from '@purescience/platform-ui/components/common/feedback/Badge'
import { FormField } from '@purescience/platform-ui/components/common/inputs/FormField'
import {
  SelectField,
  type SelectFieldOption,
} from '@purescience/platform-ui/components/common/inputs/SelectField'
import { TextAreaField } from '@purescience/platform-ui/components/common/inputs/TextAreaField'
import { TextField } from '@purescience/platform-ui/components/common/inputs/TextField'
import { createId, taskStatusLabel } from '../lib/taskModel'
import type { TasksSessionState } from '../hooks/useTasksSession'
import type { SuiteTask, TaskLinkType, TaskPriority } from '../types'
import {
  activityDisplayText,
  activityMovedStatus,
  formatDate,
  formatShortTime,
  parseLabels,
} from './puretasksFormat'
import { TaskStatusStepper } from './TaskStatusStepper'
import {
  ActivityHeader,
  ConversationActions,
  ConversationMetaRow,
  FactsForm,
  BreadcrumbCurrent,
  BreadcrumbSeparator,
  BreadcrumbTrail,
  CapsuleCloseButton,
  CardDetailLayout,
  CardDetailMain,
  CardDetailSide,
  CardHeaderActions,
  CardOverlayBackdrop,
  CardOverlayFooter,
  CardOverlayHeader,
  CardOverlayPanel,
  CardSubtitle,
  CardTitleRow,
  ChecklistBody,
  ChecklistIconButton,
  ChecklistItemButton,
  ChecklistRow,
  ChecklistTitleButton,
  CommentComposer,
  CompactForm,
  CompleteToggle,
  CompletedChecklistText,
  ConversationAvatar,
  ConversationBubble,
  ConversationItem,
  ConversationSpine,
  ConversationStatusName,
  ConversationText,
  ConversationTime,
  DetailSection,
  DetailSectionTitle,
  EmptyActionRow,
  FooterActions,
  FooterCloseButton,
  FooterDeleteButton,
  FooterSavedState,
  InlineForm,
  InlineGrid,
  LinkRow,
  MutedText,
  OverlayActionCapsule,
  ProgressFill,
  ProgressTrack,
  RowLabel,
  SectionHeader,
  SectionHeaderActions,
  WorkSection,
  WorkSectionBody,
  WorkSectionIcon,
} from './puretasksShellStyles'

const PRIORITY_OPTIONS: SelectFieldOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
]

const LINK_TYPE_OPTIONS: SelectFieldOption[] = [
  { value: 'file', label: 'File' },
  { value: 'writer', label: 'Writer' },
  { value: 'book', label: 'Book' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'chat-message', label: 'Chat message' },
  { value: 'agent-run', label: 'Agent run' },
]

const ACTIVITY_MODE_OPTIONS: SelectFieldOption[] = [
  { value: 'all', label: 'All' },
  { value: 'comments', label: 'Comments' },
  { value: 'activity', label: 'Activity' },
]

interface TaskCardInfoModalProps {
  session: TasksSessionState
  task: SuiteTask | null
  onClose: () => void
}

export function TaskCardInfoModal({
  session,
  task,
  onClose,
}: TaskCardInfoModalProps): React.ReactElement | null {
  if (!task) return null
  const done = session.isDoneStatus(task.status)
  const firstDoneColumn =
    session.columns.find(column => column.done)?.id ?? 'done'
  const firstOpenColumn =
    session.columns.find(column => !column.done)?.id ?? 'inbox'

  return (
    <CardOverlayBackdrop
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <CardOverlayPanel
        aria-modal="true"
        role="dialog"
        aria-labelledby="task-card-overlay-title"
      >
        <CardOverlayHeader>
          <BreadcrumbTrail>
            <span>{session.activeProject.name}</span>
            <BreadcrumbSeparator>
              <PlatformIcon icon={ChevronRight} size={13} strokeWidth={2} />
            </BreadcrumbSeparator>
            <BreadcrumbCurrent>{task.title}</BreadcrumbCurrent>
          </BreadcrumbTrail>
          <CardHeaderActions>
            <TaskStatusStepper session={session} task={task} />
            <OverlayActionCapsule>
              <CapsuleCloseButton
                type="button"
                aria-label="Close card"
                title="Close card"
                onClick={onClose}
              >
                <PlatformIcon icon={X} size={14} strokeWidth={2} />
              </CapsuleCloseButton>
            </OverlayActionCapsule>
          </CardHeaderActions>
        </CardOverlayHeader>
        <CardDetailLayout>
          <CardDetailMain>
            <CardTitleRow>
              <CompleteToggle
                $done={done}
                type="button"
                title={done ? 'Mark not done' : 'Mark done'}
                onClick={() =>
                  void session.moveTask(
                    task.id,
                    done ? firstOpenColumn : firstDoneColumn,
                  )
                }
              >
                {done ? (
                  <PlatformIcon icon={Check} size={15} strokeWidth={2.4} />
                ) : null}
              </CompleteToggle>
              <div>
                <span id="task-card-overlay-title" hidden>
                  {task.title}
                </span>
                <TaskTitleEditor task={task} session={session} />
                <CardSubtitle>
                  {taskStatusLabel(session.columns, task.status)} in{' '}
                  {session.activeProject.name}
                </CardSubtitle>
              </div>
            </CardTitleRow>

            <WorkSection>
              <WorkSectionIcon>
                <PlatformIcon icon={AlignLeft} size={16} strokeWidth={1.9} />
              </WorkSectionIcon>
              <WorkSectionBody>
                <DetailSectionTitle>Description</DetailSectionTitle>
                <TaskDescriptionEditor task={task} session={session} />
              </WorkSectionBody>
            </WorkSection>

            <WorkSection>
              <WorkSectionIcon>
                <PlatformIcon icon={Info} size={16} strokeWidth={1.9} />
              </WorkSectionIcon>
              <WorkSectionBody>
                <DetailSectionTitle>Card details</DetailSectionTitle>
                <TaskFactsEditor task={task} session={session} />
              </WorkSectionBody>
            </WorkSection>

            <WorkSection>
              <WorkSectionIcon>
                <PlatformIcon icon={ListChecks} size={16} strokeWidth={1.9} />
              </WorkSectionIcon>
              <WorkSectionBody>
                <DetailSectionTitle>Checklists</DetailSectionTitle>
                <TaskChecklistEditor task={task} session={session} />
              </WorkSectionBody>
            </WorkSection>

            <WorkSection>
              <WorkSectionIcon>
                <PlatformIcon icon={Link2} size={16} strokeWidth={1.9} />
              </WorkSectionIcon>
              <WorkSectionBody>
                <DetailSectionTitle>Linked resources</DetailSectionTitle>
                <TaskResourceLinksEditor task={task} session={session} />
              </WorkSectionBody>
            </WorkSection>
          </CardDetailMain>
          <CardDetailSide>
            <TaskConversationPanel task={task} session={session} />
          </CardDetailSide>
        </CardDetailLayout>
        <CardOverlayFooter>
          <FooterSavedState>
            <span aria-hidden="true">✓</span>
            <span>Saved automatically</span>
          </FooterSavedState>
          <FooterActions>
            <FooterDeleteButton
              size="sm"
              variant="subtle"
              onClick={() => {
                void session.deleteTask(task.id)
                onClose()
              }}
            >
              Delete
            </FooterDeleteButton>
            <FooterCloseButton size="sm" variant="subtle" onClick={onClose}>
              Close
            </FooterCloseButton>
          </FooterActions>
        </CardOverlayFooter>
      </CardOverlayPanel>
    </CardOverlayBackdrop>
  )
}

function TaskTitleEditor({
  session,
  task,
}: {
  session: TasksSessionState
  task: SuiteTask
}): React.ReactElement {
  const titleId = useId()
  const [title, setTitle] = useState(task.title)

  useEffect(() => {
    setTitle(task.title)
  }, [task])

  async function saveTitle(): Promise<void> {
    const trimmed = title.trim()
    if (!trimmed || trimmed === task.title) return
    await session.updateTask(task.id, { title: trimmed })
  }

  return (
    <CompactForm
      onSubmit={event => {
        event.preventDefault()
        void saveTitle()
      }}
    >
      <TextField
        id={titleId}
        value={title}
        onBlur={() => void saveTitle()}
        onChange={event => setTitle(event.target.value)}
        placeholder="Task title"
      />
    </CompactForm>
  )
}

function TaskDescriptionEditor({
  session,
  task,
}: {
  session: TasksSessionState
  task: SuiteTask
}): React.ReactElement {
  const descriptionId = useId()
  const [notes, setNotes] = useState(task.notes)

  useEffect(() => {
    setNotes(task.notes)
  }, [task])

  async function saveNotes(): Promise<void> {
    if (notes === task.notes) return
    await session.updateTask(task.id, { notes })
  }

  return (
    <CompactForm
      onSubmit={event => {
        event.preventDefault()
        void saveNotes()
      }}
    >
      <TextAreaField
        id={descriptionId}
        value={notes}
        onBlur={() => void saveNotes()}
        onChange={event => setNotes(event.target.value)}
        placeholder="Add a description..."
      />
    </CompactForm>
  )
}

function TaskFactsEditor({
  session,
  task,
}: {
  session: TasksSessionState
  task: SuiteTask
}): React.ReactElement {
  const ownerId = useId()
  const priorityId = useId()
  const dueId = useId()
  const labelsId = useId()
  const [ownerName, setOwnerName] = useState(task.ownerName ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueAt, setDueAt] = useState(formatDate(task.dueAt))
  const [labels, setLabels] = useState(task.labels.join(', '))

  useEffect(() => {
    setOwnerName(task.ownerName ?? '')
    setPriority(task.priority)
    setDueAt(formatDate(task.dueAt))
    setLabels(task.labels.join(', '))
  }, [task])

  async function saveFacts(): Promise<void> {
    await session.updateTask(task.id, {
      ownerName,
      priority,
      dueAt: dueAt.trim(),
      labels: parseLabels(labels),
    })
  }

  return (
    <CompactForm
      onSubmit={event => {
        event.preventDefault()
        void saveFacts()
      }}
    >
      <FactsForm>
        <FormField label="Owner" htmlFor={ownerId}>
          <TextField
            id={ownerId}
            value={ownerName}
            onBlur={() => void saveFacts()}
            onChange={event => setOwnerName(event.target.value)}
            placeholder="Owner name"
          />
        </FormField>
        <FormField label="Priority" htmlFor={priorityId}>
          <SelectField
            id={priorityId}
            value={priority}
            options={PRIORITY_OPTIONS}
            onValueChange={next => {
              setPriority(next as TaskPriority)
              void session.updateTask(task.id, {
                priority: next as TaskPriority,
              })
            }}
          />
        </FormField>
        <FormField label="Due date" htmlFor={dueId}>
          <TextField
            id={dueId}
            type="date"
            value={dueAt}
            onBlur={() => void saveFacts()}
            onChange={event => setDueAt(event.target.value)}
          />
        </FormField>
        <FormField label="Labels" htmlFor={labelsId}>
          <TextField
            id={labelsId}
            value={labels}
            onBlur={() => void saveFacts()}
            onChange={event => setLabels(event.target.value)}
            placeholder="book, blocked"
          />
        </FormField>
      </FactsForm>
    </CompactForm>
  )
}

export function TaskChecklistEditor({
  session,
  task,
}: {
  session: TasksSessionState
  task: SuiteTask
}): React.ReactElement {
  const newChecklistId = useId()
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [newItemText, setNewItemText] = useState<Record<string, string>>({})
  // Inline-edit state: at most one checklist title and one item edited at a time.
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemValue, setEditItemValue] = useState('')

  async function addChecklist(): Promise<void> {
    const title = newChecklistTitle.trim()
    if (!title) return
    const now = new Date().toISOString()
    await session.updateTask(task.id, {
      checklists: [
        ...task.checklists,
        {
          id: createId('checklist'),
          title,
          items: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    })
    setNewChecklistTitle('')
  }

  async function addChecklistItem(checklistId: string): Promise<void> {
    const text = newItemText[checklistId]?.trim()
    if (!text) return
    const now = new Date().toISOString()
    await session.updateTask(task.id, {
      checklists: task.checklists.map(checklist =>
        checklist.id === checklistId
          ? {
              ...checklist,
              updatedAt: now,
              items: [
                ...checklist.items,
                {
                  id: createId('checklist-item'),
                  text,
                  done: false,
                  createdAt: now,
                  updatedAt: now,
                },
              ],
            }
          : checklist,
      ),
    })
    setNewItemText(current => ({ ...current, [checklistId]: '' }))
  }

  async function toggleChecklistItem(
    checklistId: string,
    itemId: string,
  ): Promise<void> {
    const now = new Date().toISOString()
    await session.updateTask(task.id, {
      checklists: task.checklists.map(checklist =>
        checklist.id === checklistId
          ? {
              ...checklist,
              updatedAt: now,
              items: checklist.items.map(item =>
                item.id === itemId
                  ? { ...item, done: !item.done, updatedAt: now }
                  : item,
              ),
            }
          : checklist,
      ),
    })
  }

  async function renameChecklist(
    checklistId: string,
    title: string,
  ): Promise<void> {
    const trimmed = title.trim()
    const current = task.checklists.find(
      checklist => checklist.id === checklistId,
    )
    if (!current || !trimmed || trimmed === current.title) return
    const now = new Date().toISOString()
    await session.updateTask(task.id, {
      checklists: task.checklists.map(checklist =>
        checklist.id === checklistId
          ? { ...checklist, title: trimmed, updatedAt: now }
          : checklist,
      ),
    })
  }

  async function deleteChecklist(checklistId: string): Promise<void> {
    await session.updateTask(task.id, {
      checklists: task.checklists.filter(
        checklist => checklist.id !== checklistId,
      ),
    })
  }

  async function removeChecklistItem(
    checklistId: string,
    itemId: string,
  ): Promise<void> {
    const now = new Date().toISOString()
    await session.updateTask(task.id, {
      checklists: task.checklists.map(checklist =>
        checklist.id === checklistId
          ? {
              ...checklist,
              updatedAt: now,
              items: checklist.items.filter(item => item.id !== itemId),
            }
          : checklist,
      ),
    })
  }

  async function saveChecklistItemText(
    checklistId: string,
    itemId: string,
    text: string,
  ): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed) {
      // Clearing the text removes the item.
      await removeChecklistItem(checklistId, itemId)
      return
    }
    const now = new Date().toISOString()
    await session.updateTask(task.id, {
      checklists: task.checklists.map(checklist =>
        checklist.id === checklistId
          ? {
              ...checklist,
              updatedAt: now,
              items: checklist.items.map(item =>
                item.id === itemId
                  ? { ...item, text: trimmed, updatedAt: now }
                  : item,
              ),
            }
          : checklist,
      ),
    })
  }

  function beginEditTitle(checklistId: string, title: string): void {
    setEditingTitleId(checklistId)
    setEditTitleValue(title)
  }

  function commitEditTitle(): void {
    if (editingTitleId) void renameChecklist(editingTitleId, editTitleValue)
    setEditingTitleId(null)
    setEditTitleValue('')
  }

  function beginEditItem(itemId: string, text: string): void {
    setEditingItemId(itemId)
    setEditItemValue(text)
  }

  function commitEditItem(checklistId: string): void {
    if (editingItemId)
      void saveChecklistItemText(checklistId, editingItemId, editItemValue)
    setEditingItemId(null)
    setEditItemValue('')
  }

  return (
    <CompactForm
      onSubmit={event => {
        event.preventDefault()
        void addChecklist()
      }}
    >
      {task.checklists.length === 0 ? (
        <EmptyActionRow>
          <span>No checklists yet. Add one below.</span>
        </EmptyActionRow>
      ) : (
        task.checklists.map(checklist => {
          const done = checklist.items.filter(item => item.done).length
          const percent =
            checklist.items.length === 0
              ? 0
              : Math.round((done / checklist.items.length) * 100)
          return (
            <DetailSection key={checklist.id}>
              <SectionHeader>
                {editingTitleId === checklist.id ? (
                  <TextField
                    autoFocus
                    value={editTitleValue}
                    onChange={event => setEditTitleValue(event.target.value)}
                    onBlur={commitEditTitle}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitEditTitle()
                      }
                      if (event.key === 'Escape') {
                        setEditingTitleId(null)
                        setEditTitleValue('')
                      }
                    }}
                  />
                ) : (
                  <ChecklistTitleButton
                    type="button"
                    title="Rename checklist"
                    onClick={() =>
                      beginEditTitle(checklist.id, checklist.title)
                    }
                  >
                    {checklist.title}
                  </ChecklistTitleButton>
                )}
                <SectionHeaderActions>
                  <Badge tone="neutral">
                    {done}/{checklist.items.length}
                  </Badge>
                  <ChecklistIconButton
                    type="button"
                    title="Delete checklist"
                    aria-label={`Delete checklist ${checklist.title}`}
                    onClick={() => void deleteChecklist(checklist.id)}
                  >
                    <PlatformIcon icon={Trash2} size={14} strokeWidth={1.9} />
                  </ChecklistIconButton>
                </SectionHeaderActions>
              </SectionHeader>
              <ProgressTrack>
                <ProgressFill $percent={percent} />
              </ProgressTrack>
              <ChecklistBody>
                {checklist.items.map(item => (
                  <ChecklistRow key={item.id}>
                    <input
                      checked={item.done}
                      type="checkbox"
                      onChange={() =>
                        void toggleChecklistItem(checklist.id, item.id)
                      }
                    />
                    {editingItemId === item.id ? (
                      <TextField
                        autoFocus
                        value={editItemValue}
                        onChange={event => setEditItemValue(event.target.value)}
                        onBlur={() => commitEditItem(checklist.id)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitEditItem(checklist.id)
                          }
                          if (event.key === 'Escape') {
                            setEditingItemId(null)
                            setEditItemValue('')
                          }
                        }}
                      />
                    ) : (
                      <ChecklistItemButton
                        type="button"
                        title="Edit item"
                        onClick={() => beginEditItem(item.id, item.text)}
                      >
                        <CompletedChecklistText $done={item.done}>
                          {item.text}
                        </CompletedChecklistText>
                      </ChecklistItemButton>
                    )}
                    <ChecklistIconButton
                      type="button"
                      title="Remove item"
                      aria-label="Remove checklist item"
                      onClick={() =>
                        void removeChecklistItem(checklist.id, item.id)
                      }
                    >
                      <PlatformIcon icon={X} size={13} strokeWidth={2} />
                    </ChecklistIconButton>
                  </ChecklistRow>
                ))}
                <InlineGrid>
                  <TextField
                    value={newItemText[checklist.id] ?? ''}
                    onChange={event =>
                      setNewItemText(current => ({
                        ...current,
                        [checklist.id]: event.target.value,
                      }))
                    }
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void addChecklistItem(checklist.id)
                      }
                    }}
                    placeholder="Add checklist item"
                  />
                  <Button
                    size="sm"
                    type="button"
                    disabled={!newItemText[checklist.id]?.trim()}
                    onClick={() => void addChecklistItem(checklist.id)}
                  >
                    Add
                  </Button>
                </InlineGrid>
              </ChecklistBody>
            </DetailSection>
          )
        })
      )}
      <InlineGrid>
        <TextField
          id={newChecklistId}
          value={newChecklistTitle}
          onChange={event => setNewChecklistTitle(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void addChecklist()
            }
          }}
          placeholder="New checklist"
        />
        <Button type="submit" size="sm" disabled={!newChecklistTitle.trim()}>
          Add checklist
        </Button>
      </InlineGrid>
    </CompactForm>
  )
}

export function TaskResourceLinksEditor({
  session,
  task,
}: {
  session: TasksSessionState
  task: SuiteTask
}): React.ReactElement {
  const linkTitleId = useId()
  const [linkType, setLinkType] = useState<TaskLinkType>('file')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkPath, setLinkPath] = useState('')
  const [linkAppSlug, setLinkAppSlug] = useState('')
  const [linkResourceId, setLinkResourceId] = useState('')

  async function addLink(): Promise<void> {
    if (!linkTitle.trim() && !linkPath.trim() && !linkResourceId.trim()) return
    await session.addLink(task.id, {
      type: linkType,
      title: linkTitle,
      path: linkPath,
      appSlug: linkAppSlug,
      resourceId: linkResourceId,
    })
    setLinkTitle('')
    setLinkPath('')
    setLinkAppSlug('')
    setLinkResourceId('')
  }

  return (
    <CompactForm
      onSubmit={event => {
        event.preventDefault()
        void addLink()
      }}
    >
      {task.links.length === 0 ? (
        <EmptyActionRow>
          <span>Nothing linked yet. Add a link below.</span>
        </EmptyActionRow>
      ) : (
        task.links.map(link => (
          <LinkRow key={link.id}>
            <RowLabel title={link.path ?? link.resourceId}>
              {link.title}
              {link.appSlug ? ` · ${link.appSlug}` : ''}
            </RowLabel>
            <Button
              size="sm"
              disabled={!link.path}
              onClick={() => void session.openLink(link)}
            >
              Open
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => void session.removeLink(task.id, link.id)}
            >
              Remove
            </Button>
          </LinkRow>
        ))
      )}
      <InlineForm>
        <SelectField
          value={linkType}
          options={LINK_TYPE_OPTIONS}
          onValueChange={value => setLinkType(value as TaskLinkType)}
          aria-label="Link type"
        />
        <TextField
          id={linkTitleId}
          value={linkTitle}
          onChange={event => setLinkTitle(event.target.value)}
          placeholder="Link title"
        />
      </InlineForm>
      <InlineForm>
        <TextField
          value={linkPath}
          onChange={event => setLinkPath(event.target.value)}
          placeholder="Path"
        />
        <TextField
          value={linkAppSlug}
          onChange={event => setLinkAppSlug(event.target.value)}
          placeholder="App slug"
        />
      </InlineForm>
      <InlineGrid>
        <TextField
          value={linkResourceId}
          onChange={event => setLinkResourceId(event.target.value)}
          placeholder="Resource id"
        />
        <Button
          type="submit"
          size="sm"
          disabled={
            !linkTitle.trim() && !linkPath.trim() && !linkResourceId.trim()
          }
        >
          Add link
        </Button>
      </InlineGrid>
    </CompactForm>
  )
}

export function TaskConversationPanel({
  session,
  task,
}: {
  session: TasksSessionState
  task: SuiteTask
}): React.ReactElement {
  const commentId = useId()
  const modeId = useId()
  const [comment, setComment] = useState('')
  const [mode, setMode] = useState<'comments' | 'activity' | 'all'>('all')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentValue, setEditCommentValue] = useState('')
  const taskActivity = session.store.activity.filter(
    item => item.taskId === task.id,
  )

  async function addComment(): Promise<void> {
    const text = comment.trim()
    if (!text) return
    const now = new Date().toISOString()
    await session.updateTask(task.id, {
      comments: [
        {
          id: createId('comment'),
          authorName: 'PureScience User',
          text,
          createdAt: now,
          updatedAt: now,
        },
        ...task.comments,
      ],
    })
    setComment('')
  }

  async function saveComment(commentId: string, text: string): Promise<void> {
    const trimmed = text.trim()
    const existing = task.comments.find(item => item.id === commentId)
    if (!existing || !trimmed || trimmed === existing.text) return
    const now = new Date().toISOString()
    await session.updateTask(task.id, {
      comments: task.comments.map(item =>
        item.id === commentId
          ? { ...item, text: trimmed, updatedAt: now }
          : item,
      ),
    })
  }

  async function deleteComment(commentId: string): Promise<void> {
    await session.updateTask(task.id, {
      comments: task.comments.filter(item => item.id !== commentId),
    })
  }

  function commitEditComment(): void {
    if (editingCommentId) void saveComment(editingCommentId, editCommentValue)
    setEditingCommentId(null)
    setEditCommentValue('')
  }

  const entries = [
    ...(mode !== 'activity'
      ? task.comments.map(item => ({
          id: item.id,
          at: item.createdAt,
          authorName: item.authorName || 'PureScience User',
          text: item.text,
          kind: 'comment' as const,
        }))
      : []),
    ...(mode !== 'comments'
      ? taskActivity.map(item => ({
          id: item.id,
          at: item.at,
          authorName: 'PureTasks',
          text: item.text,
          kind: 'activity' as const,
        }))
      : []),
  ].sort((a, b) => b.at.localeCompare(a.at))

  function renderActivityText(text: string): React.ReactNode {
    const movedStatus = activityMovedStatus(text)
    if (!movedStatus) return activityDisplayText(text)
    return (
      <>
        moved →{' '}
        <ConversationStatusName $status={movedStatus}>
          {taskStatusLabel(session.columns, movedStatus)}
        </ConversationStatusName>
      </>
    )
  }

  return (
    <>
      <ActivityHeader>
        <DetailSectionTitle>Activity</DetailSectionTitle>
        <SelectField
          id={modeId}
          value={mode}
          options={ACTIVITY_MODE_OPTIONS}
          onValueChange={value =>
            setMode(value as 'comments' | 'activity' | 'all')
          }
          aria-label="Activity filter"
        />
      </ActivityHeader>
      <CommentComposer
        onSubmit={event => {
          event.preventDefault()
          void addComment()
        }}
      >
        <TextField
          id={commentId}
          value={comment}
          onChange={event => setComment(event.target.value)}
          placeholder="Write a comment..."
        />
      </CommentComposer>
      {entries.length === 0 ? (
        <MutedText>No comments or activity yet.</MutedText>
      ) : (
        <ConversationSpine>
          {entries.map(entry => (
            <ConversationItem key={`${entry.kind}-${entry.id}`}>
              <ConversationAvatar />
              <ConversationBubble>
                {entry.kind === 'comment' && editingCommentId === entry.id ? (
                  <TextField
                    autoFocus
                    value={editCommentValue}
                    aria-label="Edit comment"
                    onChange={event => setEditCommentValue(event.target.value)}
                    onBlur={commitEditComment}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitEditComment()
                      }
                      if (event.key === 'Escape') {
                        setEditingCommentId(null)
                        setEditCommentValue('')
                      }
                    }}
                  />
                ) : (
                  <ConversationText>
                    {entry.kind === 'activity'
                      ? renderActivityText(entry.text)
                      : entry.text}
                  </ConversationText>
                )}
                <ConversationMetaRow>
                  <ConversationTime>
                    {entry.kind === 'comment' ? `${entry.authorName} · ` : ''}
                    {formatShortTime(entry.at)}
                  </ConversationTime>
                  {entry.kind === 'comment' ? (
                    <ConversationActions>
                      <ChecklistIconButton
                        type="button"
                        title="Edit comment"
                        aria-label="Edit comment"
                        onClick={() => {
                          setEditingCommentId(entry.id)
                          setEditCommentValue(entry.text)
                        }}
                      >
                        <PlatformIcon
                          icon={Pencil}
                          size={13}
                          strokeWidth={1.9}
                        />
                      </ChecklistIconButton>
                      <ChecklistIconButton
                        type="button"
                        title="Delete comment"
                        aria-label="Delete comment"
                        onClick={() => void deleteComment(entry.id)}
                      >
                        <PlatformIcon
                          icon={Trash2}
                          size={13}
                          strokeWidth={1.9}
                        />
                      </ChecklistIconButton>
                    </ConversationActions>
                  ) : null}
                </ConversationMetaRow>
              </ConversationBubble>
            </ConversationItem>
          ))}
        </ConversationSpine>
      )}
    </>
  )
}
