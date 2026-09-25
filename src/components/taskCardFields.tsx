import { useLayoutEffect, useRef, useState } from 'react'
import { styled } from 'styled-components'
import type { SuiteTask, TaskViewMode } from '../types'
import { MutedText } from './puretasksShellStyles'

/** How many lines of the description to show before offering "See more". */
const NOTES_CLAMP_LINES = 3

const NotesPreviewWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const NotesPreviewText = styled(MutedText)<{ $clamped: boolean }>`
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  ${({ $clamped }) =>
    $clamped
      ? `
    display: -webkit-box;
    -webkit-line-clamp: ${NOTES_CLAMP_LINES};
    -webkit-box-orient: vertical;
    overflow: hidden;
  `
      : ''}
`

const SeeMoreButton = styled.button`
  align-self: flex-start;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--platform-colors-text-secondary);
  font-size: var(--platform-typography-font-size-sm);
  font-weight: 650;
  cursor: pointer;

  &:hover {
    color: var(--platform-colors-text);
    text-decoration: underline;
  }
`

/**
 * Task description preview that clamps a long note to a few lines with a
 * "See more" / "See less" toggle. The button only appears when the text
 * actually overflows the clamp. `stopPropagation` keeps a card-level click
 * (which opens the task) from firing when the user just toggles the preview.
 */
function TaskNotesPreview({ notes }: { notes: string }): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const textRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = textRef.current
    if (!el || expanded) return
    setOverflowing(el.scrollHeight - el.clientHeight > 1)
  }, [notes, expanded])

  return (
    <NotesPreviewWrap>
      <NotesPreviewText ref={textRef} $clamped={!expanded} as="span">
        {notes}
      </NotesPreviewText>
      {overflowing || expanded ? (
        <SeeMoreButton
          type="button"
          onClick={event => {
            event.stopPropagation()
            setExpanded(current => !current)
          }}
        >
          {expanded ? 'See less' : 'See more'}
        </SeeMoreButton>
      ) : null}
    </NotesPreviewWrap>
  )
}

interface TaskCardFaceField {
  id: string
  isVisible?: (task: SuiteTask) => boolean
  render: (task: SuiteTask) => React.ReactNode
}

export const TASK_VIEW_TABS: Array<{ id: TaskViewMode; label: string }> = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'files', label: 'Files' },
  { id: 'activity', label: 'Activity' },
]

export const TASK_CARD_SUMMARY_FIELDS: TaskCardFaceField[] = [
  {
    id: 'notesPreview',
    isVisible: task => task.notes.trim().length > 0,
    render: task => <TaskNotesPreview notes={task.notes} />,
  },
]
