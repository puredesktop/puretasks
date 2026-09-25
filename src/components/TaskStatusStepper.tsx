import type { TasksSessionState } from '../hooks/useTasksSession'
import type { SuiteTask, TaskStatus } from '../types'
import {
  StatusStepBar,
  StatusStepperCaret,
  StatusStepperControl,
  StatusStepperIndex,
  StatusStepperLabel,
  StatusStepperSelect,
  StatusSteps,
} from './puretasksShellStyles'

interface TaskStatusStepperProps {
  session: TasksSessionState
  task: SuiteTask
}

export function TaskStatusStepper({
  session,
  task,
}: TaskStatusStepperProps): React.ReactElement {
  const statusOrder = session.columns.map(column => column.id)
  const currentIndex = Math.max(0, statusOrder.indexOf(task.status))
  const isDone = session.isDoneStatus(task.status)

  return (
    <StatusStepperControl title="Change task status">
      <StatusSteps aria-hidden="true">
        {session.columns.map((column, index) => (
          <StatusStepBar
            key={column.id}
            $active={index <= currentIndex}
            $done={isDone}
          />
        ))}
      </StatusSteps>
      <StatusStepperLabel aria-hidden="true">
        <span>
          {session.columns.find(column => column.id === task.status)?.label ??
            task.status}
        </span>
        <StatusStepperIndex>
          {currentIndex + 1}/{session.columns.length}
        </StatusStepperIndex>
        <StatusStepperCaret>▾</StatusStepperCaret>
      </StatusStepperLabel>
      <StatusStepperSelect
        value={task.status}
        onChange={event =>
          void session.moveTask(task.id, event.target.value as TaskStatus)
        }
        aria-label="Task status"
      >
        {session.columns.map(column => (
          <option key={column.id} value={column.id}>
            {column.label}
          </option>
        ))}
      </StatusStepperSelect>
    </StatusStepperControl>
  )
}
