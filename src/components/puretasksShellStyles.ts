import { Button } from '@purescience/platform-ui/components/common/buttons/Button'
import { BareInput } from '@purescience/platform-ui/components/common/inputs/BareInput'
import {
  OverlayActionCapsule as PlatformOverlayActionCapsule,
  OverlayActionCapsuleCloseButton as PlatformOverlayActionCapsuleCloseButton,
} from '@purescience/platform-ui/components/chrome/OverlayActionCapsule'
import { styled } from 'styled-components'
import type { SemanticChipTone } from './puretasksFormat'
import { FlexRow } from '@purescience/platform-ui/components/common/containers/flex'

function columnStatusColor(status: string, done?: boolean): string {
  if (done || status === 'done') return 'var(--puretasks-status-success)'
  if (status === 'doing') return 'var(--puretasks-status-info)'
  if (status === 'review') return 'var(--puretasks-status-attention)'
  return 'var(--puretasks-status-neutral)'
}

function columnStatusTint(status: string, done?: boolean): string {
  return `color-mix(in srgb, ${columnStatusColor(
    status,
    done,
  )} 12%, transparent)`
}

export const StyledTasksShell = styled.div`
  --puretasks-radius-control: var(--platform-radius-sm);
  --puretasks-radius-panel: var(--platform-radius-md);
  --puretasks-shadow-panel: var(--platform-shadow-sm);
  --puretasks-shadow-card: 0 1px 2px rgb(28 26 23 / 6%);
  /* Rows sit on the platform list-row measure; the mono face is the platform's. */
  --puretasks-row-height: var(--pure-chrome-list-row-height);
  --puretasks-column-width: 260px;
  --puretasks-status-neutral: var(--platform-colors-border-strong);
  --puretasks-status-info: #3b6fb0;
  --puretasks-status-attention: #c98a2b;
  --puretasks-status-success: #1f8a55;
  --ink-faint: var(--platform-colors-text-disabled);

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--canvas, var(--platform-colors-bg));
  color: var(--platform-colors-text);
`

export const StyledMainPane = styled.main`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`

export const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  > div:first-child {
    width: min(420px, 42vw);
  }
`

/** The board name — the document's naming surface. */
export const BoardTitleInput = styled(BareInput)`
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 2px 0;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: var(--platform-colors-text);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  outline: none;

  &:hover,
  &:focus {
    border-bottom-color: var(--platform-colors-border);
  }

  &::placeholder {
    color: var(--ink-faint);
  }
`

/** The board description — one line under the name, edited in place. */
export const BoardDescriptionInput = styled(BareInput)`
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 1px 0;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: var(--platform-colors-text-secondary);
  font-size: var(--platform-typography-font-size-sm);
  line-height: 1.3;
  outline: none;

  &:hover,
  &:focus {
    border-bottom-color: var(--platform-colors-border);
  }

  &::placeholder {
    color: var(--ink-faint);
  }
`

export const MutedText = styled.span`
  color: var(--platform-colors-text-secondary);
  font-size: var(--platform-typography-font-size-sm);
  line-height: 1.35;
`

export const MetadataText = styled(MutedText)`
  color: var(--ink-faint);
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-meta-size);
  font-weight: 600;
  letter-spacing: 0;
`

export const ProjectChrome = styled.div`
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--platform-colors-border);
  background: var(--canvas, var(--platform-colors-bg));
`

export const ChromeTopRow = styled.div`
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto;
  gap: 20px;
  align-items: center;
  min-height: 76px;
  padding: 10px 28px 8px;

  @media (max-width: 1040px) {
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 0 20px;
  }
`

export const HeaderProjectControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;

  @media (max-width: 920px) {
    flex-wrap: wrap;
  }
`

export const TasksTabToolbar = styled(FlexRow)`
  display: flex;
  gap: 8px;
  width: fit-content;
  color: var(--platform-colors-text-secondary);

  [aria-label='Filter by status'],
  [aria-label='Filter by label'] {
    font-family: var(--platform-typography-font-family-mono);
    font-size: var(--pure-chrome-meta-size);
    font-weight: 600;
    letter-spacing: 0;
  }
`

/** Wrap platform Tabs — restores PureTasks view tab chrome via Tabs class hooks. */
export const StyledTasksTabs = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;

  .tbs-actions-container {
    flex: 0 0 auto;
    align-items: center;
    min-height: 50px;
    padding: 0 28px;
    border-top: 1px solid var(--platform-colors-divider);
    background: var(--canvas, var(--platform-colors-bg));

    @media (max-width: 920px) {
      padding: 0 20px;
    }
  }

  .tabs-header {
    gap: 4px;
    min-height: 42px;
    padding: 0;
    border-bottom: none;
    background: transparent;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .tab-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    margin-bottom: 0;
    border: 1px solid transparent;
    border-radius: var(--puretasks-radius-control);
    border-bottom: none !important;
    background: transparent;
    box-shadow: none;
    white-space: nowrap;
    font: inherit;
    font-size: var(--platform-typography-font-size-sm);
    color: var(--platform-colors-text-secondary);
    font-weight: 600;

    &[aria-selected='true'] {
      color: var(--platform-colors-text);
      border-color: transparent;
      background: transparent;
      font-weight: 650;
    }

    &::after {
      position: absolute;
      right: 0;
      bottom: -1px;
      left: 0;
      height: 0;
      border-radius: var(--platform-radius-sm);
      background: transparent;
      content: '';
    }

    &[aria-selected='true']::after {
      height: 2px;
      background: var(--pure-chrome-accent);
    }

    &:hover:not(:disabled) {
      border-color: transparent;
      background: transparent;
      color: var(--platform-colors-text);
    }
  }

  & > * > *:last-child {
    padding: 0;
  }
`

export const PrimaryTaskButton = styled(Button)`
  && {
    min-height: var(--pure-chrome-field-height);
    padding: 0 12px;
    border-color: var(--pure-chrome-accent);
    border-radius: var(--puretasks-radius-control);
    background: var(--pure-chrome-accent);
    color: var(--pure-chrome-on-accent);
    font-size: var(--platform-typography-font-size-sm);
    font-weight: 650;
    box-shadow: var(--puretasks-shadow-card);
  }

  &&:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--pure-chrome-accent) 85%, var(--platform-colors-text));
    background: color-mix(in srgb, var(--pure-chrome-accent) 85%, var(--platform-colors-text));
  }
`

export const SecondaryTaskButton = styled(Button)`
  && {
    min-height: var(--pure-chrome-field-height);
    padding: 0 12px;
    border-color: var(--platform-colors-border);
    border-radius: var(--puretasks-radius-control);
    background: var(--platform-colors-surface);
    color: var(--platform-colors-text);
    font-size: var(--platform-typography-font-size-sm);
    font-weight: 650;
    box-shadow: var(--puretasks-shadow-card);
  }

  &&:hover:not(:disabled) {
    border-color: var(--platform-colors-border-strong);
    background: var(--platform-colors-surface-hover);
  }
`

export const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--platform-spacing-sm);
  color: var(--platform-colors-text-secondary);
  font-size: var(--platform-typography-font-size-sm);
  font-weight: var(--platform-typography-font-weight-bold);
`

export const RowLabel = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const InlineForm = styled.form`
  display: flex;
  gap: var(--platform-spacing-xs);
  min-width: 0;
`

export const Board = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(var(--puretasks-column-width), 1fr);
  align-items: start;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  background: var(--platform-colors-bg);

  @media (min-width: 1160px) {
    grid-auto-columns: minmax(var(--puretasks-column-width), 1fr);
  }
`

export const Column = styled.section<{
  $dragOver?: boolean
  $columnDragOver?: boolean
  $columnDropBefore?: boolean
  $done?: boolean
  $status: string
  $active?: boolean
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 8px;
  border: 1px solid
    ${({ $active }) =>
      $active ? 'var(--pure-chrome-accent)' : 'var(--pure-chrome-line)'};
  border-top-width: ${({ $active }) => ($active ? '2px' : '1px')};
  border-radius: 0;
  background: ${({ $active }) =>
    $active
      ? 'var(--pure-chrome-paper)'
      : 'var(--pure-chrome-well)'};
  box-shadow: none;
  transition: background 120ms ease, border-color 120ms ease,
    box-shadow 120ms ease;
  color: ${({ $done }) =>
    $done ? 'var(--platform-colors-text-secondary)' : 'inherit'};

  &::after {
    position: absolute;
    top: -1px;
    right: -1px;
    left: -1px;
    height: 2px;
    border-radius: 0;
    background: ${({ $status, $done }) => columnStatusColor($status, $done)};
    content: '';
  }

  ${({ $dragOver }) =>
    $dragOver ? 'border-color: var(--platform-colors-border-strong);' : ''}
  ${({ $columnDragOver }) =>
    $columnDragOver
      ? 'outline: 2px solid var(--platform-colors-border-strong); outline-offset: 4px;'
      : ''}
  ${({ $columnDropBefore }) =>
    $columnDropBefore
      ? `&::before {
          position: absolute;
          top: 10px;
          bottom: 10px;
          left: -10px;
          width: 3px;
          border-radius: var(--platform-radius-sm);
          background: var(--platform-colors-border-strong);
          content: '';
        }`
      : ''}
`

export const CollapsedColumnBody = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 118px;
  margin: 10px;
  border: 1px dashed var(--platform-colors-border);
  border-radius: var(--platform-radius-sm);
  background: transparent;
  color: var(--platform-colors-text-secondary);
  font: inherit;
  font-weight: var(--platform-typography-font-weight-bold);
  cursor: pointer;

  &:hover {
    border-color: var(--platform-colors-border-strong);
    background: var(--platform-colors-surface-hover);
    color: var(--platform-colors-text);
  }
`

export const ColumnHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--platform-spacing-sm);
  min-height: 42px;
  padding: 0 2px 8px;
  border-bottom: 0;
  font-size: var(--platform-typography-font-size-sm);
  font-weight: 650;
  color: var(--platform-colors-text);
`

export const ColumnHeaderMain = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
`

export const ColumnCount = styled.span<{
  $status: string
  $done?: boolean
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 20px;
  padding: 0 7px;
  border: 1px solid
    ${({ $status, $done }) =>
      `color-mix(in srgb, ${columnStatusColor(
        $status,
        $done,
      )} 22%, transparent)`};
  border-radius: 999px;
  background: ${({ $status, $done }) => columnStatusTint($status, $done)};
  color: ${({ $status, $done }) => columnStatusColor($status, $done)};
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-meta-size);
  font-weight: 650;
  line-height: 1;
  font-variant-numeric: tabular-nums;
`

export const ColumnWorkingTag = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding-left: 2px;
  color: var(--pure-chrome-accent);
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-label-size);
  font-weight: 700;
  letter-spacing: var(--pure-chrome-label-tracking);
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
`

export const ColumnDragHandle = styled.span`
  display: grid;
  grid-template-columns: repeat(2, 3px);
  gap: 3px;
  flex: 0 0 auto;
  width: 14px;
  padding: 3px 2px;
  border-radius: var(--platform-radius-sm);
  cursor: grab;

  span {
    width: 3px;
    height: 3px;
    border-radius: var(--platform-radius-sm);
    background: var(--platform-colors-text-disabled);
  }

  &:hover {
    background: var(--platform-colors-surface-hover);

    span {
      background: var(--platform-colors-text-secondary);
    }
  }

  &:active {
    cursor: grabbing;
  }
`

export const ColumnTitleButton = styled.button`
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  text-align: left;
  cursor: text;

  &:hover {
    color: var(--platform-colors-text);
  }
`

export const ColumnTitleInput = styled.input`
  width: 100%;
  min-width: 0;
  padding: 3px 0;
  border: 0;
  border-bottom: 1px solid var(--platform-colors-border-strong);
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  outline: none;
`

export const ColumnHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--platform-spacing-xs);
  flex-shrink: 0;
`

export const TaskList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: auto;
  padding: 0;
`

export const ColumnAdd = styled.form`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 8px 0 0;
`

export const ColumnAddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 38px;
  margin: 8px 0 0;
  padding: 0 12px;
  border: 1px dashed var(--platform-colors-border-strong);
  border-radius: var(--puretasks-radius-control);
  background: transparent;
  color: var(--platform-colors-text-secondary);
  font: inherit;
  font-size: var(--platform-typography-font-size-sm);
  font-weight: 600;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: var(--platform-colors-border-strong);
    background: var(--pure-chrome-hover);
    color: var(--platform-colors-text);
  }
`

export const BoardColumnAdd = styled.form<{ $columnDropBefore?: boolean }>`
  position: relative;
  display: grid;
  gap: 8px;
  align-content: start;
  align-self: start;
  min-width: 0;
  min-height: 0;
  margin-top: 0;
  padding: 8px;
  border: 1px dashed
    color-mix(in srgb, var(--platform-colors-border-strong) 72%, transparent);
  border-radius: 0;
  background: transparent;
  color: var(--platform-colors-text-secondary);

  input,
  textarea {
    min-height: 34px;
    border-color: color-mix(
      in srgb,
      var(--platform-colors-divider) 70%,
      transparent
    );
    border-radius: var(--puretasks-radius-control);
    background: color-mix(in srgb, var(--platform-colors-bg) 80%, transparent);
    font-size: var(--platform-typography-font-size-sm);
  }

  ${({ $columnDropBefore }) =>
    $columnDropBefore
      ? `&::before {
          position: absolute;
          top: 10px;
          bottom: 10px;
          left: -10px;
          width: 3px;
          border-radius: var(--platform-radius-sm);
          background: var(--platform-colors-border-strong);
          content: '';
        }`
      : ''}
`

export const BoardColumnAddTitle = styled.span`
  color: var(--platform-colors-text-secondary);
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-meta-size);
  font-weight: 650;
  letter-spacing: 0;
`

export const BoardColumnAddActions = styled.div`
  display: flex;
  justify-content: flex-end;
`

export const HiddenColumnList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

export const HiddenColumnButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 0 9px;
  border: 1px solid var(--platform-colors-border);
  border-radius: var(--platform-radius-sm);
  background: var(--platform-colors-surface);
  color: var(--platform-colors-text-secondary);
  font: inherit;
  font-size: var(--platform-typography-font-size-sm);
  cursor: pointer;

  &:hover {
    border-color: var(--platform-colors-border-strong);
    color: var(--platform-colors-text);
  }
`

export const TaskCard = styled.div<{
  $dropBefore?: boolean
  $dragging?: boolean
  $selected?: boolean
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: auto;
  min-width: 0;
  min-height: 0;
  padding: 12px 14px;
  background: var(--pure-chrome-paper);
  border: 1px solid var(--pure-chrome-line);
  border-radius: var(--puretasks-radius-control);
  box-shadow: var(--puretasks-shadow-card);
  ${({ $selected }) =>
    $selected
      ? 'border-color: var(--pure-chrome-line); box-shadow: var(--puretasks-shadow-card);'
      : ''}
  cursor: grab;
  opacity: ${({ $dragging }) => ($dragging ? 0.55 : 1)};
  transform: ${({ $dragging }) => ($dragging ? 'scale(0.995)' : 'none')};
  transition: background 120ms ease, border-color 120ms ease,
    box-shadow 120ms ease, opacity 120ms ease, transform 120ms ease;

  &:active {
    cursor: grabbing;
  }

  &:hover {
    background: var(--pure-chrome-paper);
    border-color: var(--platform-colors-border-strong);
    box-shadow: 0 2px 6px rgb(28 26 23 / 10%);
  }

  &:focus-within {
    border-color: var(--pure-chrome-line);
    box-shadow: var(--puretasks-shadow-card);
  }

  &[aria-selected='true'],
  &[aria-selected='true']:hover,
  &[aria-selected='true']:focus-within {
    border-color: var(--pure-chrome-line);
    box-shadow: var(--puretasks-shadow-card);
  }

  ${({ $selected }) =>
    $selected
      ? `&::before {
          position: absolute;
          top: -1px;
          bottom: -1px;
          left: -1px;
          width: 3px;
          border-radius: var(--puretasks-radius-control) 0 0 var(--puretasks-radius-control);
          background: var(--pure-chrome-accent);
          content: '';
        }`
      : ''}

  &[aria-selected='true']::before,
  &:focus-within::before {
    position: absolute;
    top: -1px;
    bottom: -1px;
    left: -1px;
    width: 3px;
    border-radius: var(--puretasks-radius-control) 0 0
      var(--puretasks-radius-control);
    background: var(--pure-chrome-accent);
    content: '';
  }
`

export const TaskDropZone = styled.div<{ $active?: boolean }>`
  height: ${({ $active }) => ($active ? '10px' : '4px')};
  border: 1px dashed
    ${({ $active }) =>
      $active
        ? 'var(--app-acc, var(--platform-colors-border-strong))'
        : 'transparent'};
  background: ${({ $active }) =>
    $active ? 'var(--platform-colors-surface-hover)' : 'transparent'};
  transition: height 120ms ease, background 120ms ease, border-color 120ms ease;
`

export const TaskCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--platform-spacing-sm);
  min-width: 0;
  cursor: pointer;
`

export const CardDetailLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 300px);
  min-width: 0;
  /* Fill the space left between the header and footer and let the two
     columns scroll internally. A hard min-height here would push the panel
     past its max-height on short windows, clipping the footer out of reach. */
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    overflow: auto;
  }
`

export const CardOverlayBackdrop = styled.div`
  --app-acc: oklch(0.63 0.15 324);
  --app-bg: oklch(0.955 0.03 324);
  --app-text: oklch(0.4 0.12 324);
  --app-block: oklch(0.4 0.06 324);
  --app-primary-fill: var(--app-acc);
  --ink-faint: var(--platform-colors-text-disabled);
  --pure-surface: var(--platform-colors-surface);
  --puretasks-status-neutral: var(--platform-colors-border-strong);
  --puretasks-status-info: #3b6fb0;
  --puretasks-status-attention: #c98a2b;
  --puretasks-status-success: #1f8a55;

  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: auto;
  padding: 76px var(--platform-spacing-lg) var(--platform-spacing-lg);
  background: color-mix(
    in srgb,
    var(--platform-colors-text) 32%,
    transparent
  );
`

export const CardOverlayPanel = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: min(1280px, 100%);
  max-height: calc(100% - 112px);
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--platform-colors-border);
  border-radius: var(--platform-radius-sm);
  background: var(--platform-colors-elevated);
  box-shadow: var(--platform-shadow-lg);

  && input:focus,
  && input:focus-visible,
  && textarea:focus,
  && textarea:focus-visible,
  && [role='combobox']:focus,
  && [role='combobox']:focus-visible {
    border-color: var(--pure-chrome-accent);
    outline: 2px solid var(--pure-chrome-accent) !important;
    outline-offset: 2px;
  }
`

export const CardOverlayHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--platform-spacing-md);
  min-height: 62px;
  padding: 0 var(--platform-spacing-lg);
  border-bottom: 1px solid var(--platform-colors-divider);

  @media (max-width: 760px) {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    padding: 12px var(--platform-spacing-lg);
  }
`

export const BreadcrumbTrail = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--platform-colors-text-secondary);
  font-size: var(--platform-typography-font-size-sm);
  font-weight: 600;
`

export const BreadcrumbCurrent = styled.span`
  min-width: 0;
  overflow: hidden;
  color: var(--platform-colors-text);
  font-weight: var(--platform-typography-font-weight-bold);
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const BreadcrumbSeparator = styled.span`
  color: var(--platform-colors-text-disabled);
`

export const CardHeaderActions = styled.div`
  display: flex;
  align-items: stretch;
  gap: 10px;
  height: 38px;
  flex-shrink: 0;

  @media (max-width: 760px) {
    width: 100%;
    justify-content: space-between;
  }
`

export const StatusStepperControl = styled.label`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  padding: 0 11px;
  border: 1px solid var(--platform-colors-divider);
  border-radius: var(--platform-radius-sm);
  background: var(--platform-colors-surface);
  color: var(--platform-colors-text);
  box-shadow: 0 1px 2px
    color-mix(in srgb, var(--platform-colors-text) 6%, transparent);
  cursor: pointer;

  &:hover {
    border-color: var(--platform-colors-border);
    background: var(--platform-colors-surface-hover);
  }

  &:focus-within {
    outline: 2px solid var(--platform-colors-border-strong);
    outline-offset: 2px;
  }
`

export const StatusSteps = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`

export const StatusStepBar = styled.span<{
  $active?: boolean
  $done?: boolean
}>`
  width: 22px;
  height: 5px;
  border-radius: var(--platform-radius-sm);
  background: ${({ $active, $done }) =>
    $done && $active
      ? 'var(--platform-colors-semantic-green-text)'
      : $active
      ? 'var(--platform-colors-border-strong)'
      : 'var(--platform-colors-border)'};
  opacity: ${({ $active }) => ($active ? 0.85 : 0.75)};
`

export const StatusStepperLabel = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-size: var(--platform-typography-font-size-sm);
  font-weight: var(--platform-typography-font-weight-bold);
  white-space: nowrap;
`

export const StatusStepperIndex = styled.span`
  color: var(--platform-colors-text-secondary);
  font-weight: 700;
`

export const StatusStepperCaret = styled.span`
  color: var(--platform-colors-text-secondary);
  font-size: 12px;
`

export const StatusStepperSelect = styled.select`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--platform-colors-surface);
  color: var(--platform-colors-text);
  color-scheme: light dark;
  opacity: 0;
  cursor: pointer;

  option {
    background: var(--platform-colors-surface);
    color: var(--platform-colors-text);
  }
`

export const OverlayActionCapsule = styled(PlatformOverlayActionCapsule)`
  border-color: var(--platform-colors-divider);
  background: var(--platform-colors-bg);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 80%),
    0 1px 3px
      color-mix(in srgb, var(--platform-colors-text) 8%, transparent);
`

export const CapsuleCloseButton = styled(
  PlatformOverlayActionCapsuleCloseButton,
)`
  font-size: 18px;
  line-height: 1;
`

export const CardDetailMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 28px 28px 34px;
`

export const CardDetailSide = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 22px 18px;
  border-left: 1px solid var(--platform-colors-divider);
  background: var(--platform-colors-surface);

  @media (max-width: 860px) {
    border-left: 0;
    border-top: 1px solid var(--platform-colors-border);
  }
`

export const CardTitleRow = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: start;
`

export const CompleteToggle = styled.button<{ $done?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-top: 3px;
  border: 2px solid
    ${({ $done }) =>
      $done
        ? 'var(--platform-colors-semantic-green-border)'
        : 'var(--platform-colors-border-strong)'};
  border-radius: var(--platform-radius-sm);
  background: ${({ $done }) =>
    $done ? 'var(--platform-colors-semantic-green-muted)' : 'transparent'};
  color: var(--platform-colors-semantic-green-text);
  font-size: 14px;
  font-weight: var(--platform-typography-font-weight-bold);
  line-height: 1;
  cursor: pointer;

  &:hover {
    border-color: ${({ $done }) =>
      $done
        ? 'var(--platform-colors-semantic-green-text)'
        : 'var(--platform-colors-accent)'};
    background: ${({ $done }) =>
      $done
        ? 'var(--platform-colors-semantic-green-muted)'
        : 'var(--platform-colors-accent-muted)'};
  }
`

export const WorkSection = styled.section`
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: var(--platform-spacing-md);
  min-width: 0;
`

export const WorkSectionIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding-top: 2px;
  border: 1px solid var(--platform-colors-divider);
  border-radius: var(--platform-radius-sm);
  background: var(--platform-colors-bg);
  color: var(--platform-colors-text-secondary);
  font-weight: var(--platform-typography-font-weight-bold);
`

export const WorkSectionBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-width: 0;
`

export const ActivityHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--platform-spacing-sm);
`

export const CommentComposer = styled.form`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--platform-spacing-sm);
  padding-bottom: var(--platform-spacing-sm);
  background: transparent;
`

export const ConversationSpine = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 8px 0 0;

  &::before {
    position: absolute;
    top: 14px;
    bottom: 14px;
    left: 5px;
    width: 1px;
    background: var(--platform-colors-divider);
    content: '';
  }
`

export const ConversationItem = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  gap: 12px;
  padding: 6px 0 10px;
  color: var(--platform-colors-text-secondary);
`

export const ConversationAvatar = styled.span`
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 5px;
  height: 5px;
  margin-top: 9px;
  margin-left: 3px;
  border-radius: var(--platform-radius-sm);
  background: var(--platform-colors-border-strong);
  color: transparent;
  font-size: 0;
  flex-shrink: 0;
`

export const ConversationBubble = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: var(--platform-typography-font-size-sm);
  line-height: 1.3;
`

export const ConversationText = styled.span`
  color: var(--platform-colors-text-secondary);
  font-weight: 600;
`

export const ConversationStatusName = styled.span<{ $status: string }>`
  color: ${({ $status }) => columnStatusColor($status)};
  font-weight: 700;
`

export const ConversationTime = styled(MutedText)`
  color: var(--pure-chrome-muted);
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-meta-size);
`

/* Edit/delete controls on a comment bubble: hidden until the row is hovered. */
export const ConversationActions = styled.span`
  display: inline-flex;
  gap: 2px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 120ms ease;

  ${ConversationItem}:hover &,
  ${ConversationItem}:focus-within & {
    opacity: 1;
  }
`

export const ConversationMetaRow = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const DetailSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: var(--platform-spacing-sm);
  min-width: 0;
  padding-bottom: var(--platform-spacing-sm);
  border-bottom: 1px solid var(--platform-colors-border);

  &:last-child {
    border-bottom: 0;
  }
`

export const DetailSectionTitle = styled.h3`
  margin: 0;
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-label-size);
  font-weight: 500;
  letter-spacing: var(--pure-chrome-label-tracking);
  text-transform: uppercase;
  color: var(--pure-chrome-muted);
`

export const CardSubtitle = styled.div`
  color: var(--platform-colors-text-secondary);
  font-size: var(--pure-chrome-ui-size);
  font-weight: 500;
`

export const CardOverlayFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--platform-spacing-md);
  min-height: 64px;
  padding: 0 28px;
  border-top: 1px solid var(--platform-colors-divider);
  background: var(--platform-colors-bg);
  color: var(--platform-colors-text-secondary);
`

export const FooterSavedState = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 10px;
  border: 1px solid var(--platform-colors-semantic-green-border);
  border-radius: var(--platform-radius-pill, 999px);
  background: var(--platform-colors-semantic-green-muted);
  color: var(--platform-colors-semantic-green-text);
  font-size: var(--platform-typography-font-size-sm);
  font-weight: 600;
`

export const FooterActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const FooterDeleteButton = styled(Button)`
  min-width: 96px;
  border-color: var(--platform-colors-semantic-red-border);
  background: var(--platform-colors-surface);
  color: var(--platform-colors-semantic-red-text);
  font-weight: var(--platform-typography-font-weight-bold);

  &:hover:not(:disabled) {
    border-color: var(--platform-colors-semantic-red-text);
    background: var(--platform-colors-semantic-red-muted);
    color: var(--platform-colors-semantic-red-text);
  }
`

export const FooterCloseButton = styled(Button)`
  min-width: 96px;
  border-color: var(--platform-colors-divider);
  background: var(--platform-colors-surface);
  color: var(--platform-colors-text);
  font-weight: var(--platform-typography-font-weight-bold);

  &:hover:not(:disabled) {
    border-color: var(--platform-colors-border);
    background: var(--platform-colors-surface-hover);
  }
`

export const ChecklistRow = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--platform-spacing-sm);
  align-items: center;
  min-width: 0;
`

/* Small ghost icon button for row-level actions (rename/delete/remove). */
export const ChecklistIconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--platform-radius-sm);
  background: transparent;
  color: var(--platform-colors-text-secondary);
  cursor: pointer;

  &:hover {
    background: var(--platform-colors-surface);
    color: var(--platform-colors-text);
  }
`

/* Click-to-edit checklist title: reads as the header text, not a button. */
export const ChecklistTitleButton = styled.button`
  flex: 1 1 auto;
  min-width: 0;
  padding: 2px 4px;
  margin-left: -4px;
  border: none;
  border-radius: var(--platform-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: text;

  &:hover {
    background: var(--platform-colors-surface);
  }
`

/* Click-to-edit checklist item: reads as plain item text, full row width. */
export const ChecklistItemButton = styled.button`
  min-width: 0;
  padding: 2px 4px;
  margin-left: -4px;
  border: none;
  border-radius: var(--platform-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: text;

  &:hover {
    background: var(--platform-colors-surface);
  }
`

/* Right-side group in a checklist header: progress badge + delete. */
export const SectionHeaderActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: var(--platform-spacing-sm);
  flex: 0 0 auto;
`

/* Indented container for a checklist's items and its "add item" input, so the
   items read as nested under the checklist title (and clearly distinct from
   the top-level "New checklist" input, which stays flush left). */
export const ChecklistBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--platform-spacing-sm);
  min-width: 0;
  margin-left: 6px;
  padding-left: 14px;
  border-left: 2px solid var(--platform-colors-border);
`

export const CompactForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: var(--platform-spacing-sm);
  min-width: 0;
`

export const InlineGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--platform-spacing-sm);
  align-items: start;
  min-width: 0;
`

// Layout grid only (no submit of its own). Must not be a <form>: it renders
// inside CompactForm, and a nested <form> is invalid HTML / a hydration error.
export const FactsForm = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  min-width: 0;

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`

export const EmptyActionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--platform-spacing-sm);
  min-height: 38px;
  padding: 0 12px;
  border: 1px dashed var(--platform-colors-border);
  border-radius: var(--platform-radius-sm);
  color: var(--platform-colors-text-secondary);
  background: var(--platform-colors-surface);
  font-style: italic;
  font-size: 13px;
  font-weight: 500;
`

export const TaskTitle = styled.strong`
  min-width: 0;
  line-height: 1.35;
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 600;
  color: var(--platform-colors-text);
`

export const CardMetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 7px;
  color: var(--platform-colors-text-secondary);
  font-size: var(--pure-chrome-meta-size);
  line-height: 1.2;
`

export const CardPriorityPill = styled.span<{ $priority: 'low' | 'high' }>`
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 5px;
  min-height: 18px;
  padding: 0 7px;
  border: 1px solid
    ${({ $priority }) =>
      $priority === 'high'
        ? 'color-mix(in srgb, var(--platform-colors-semantic-red-text) 28%, transparent)'
        : 'var(--platform-colors-border-strong)'};
  border-radius: 999px;
  background: var(--pure-chrome-paper);
  color: ${({ $priority }) =>
    $priority === 'high'
      ? 'var(--platform-colors-semantic-red-text)'
      : 'var(--platform-colors-text-secondary)'};
  font-size: var(--pure-chrome-meta-size);
  font-weight: 600;
  line-height: 1;

  span {
    width: 5px;
    height: 5px;
    border-radius: 999px;
    background: ${({ $priority }) =>
      $priority === 'high'
        ? 'var(--platform-colors-semantic-red-text)'
        : 'transparent'};
    box-shadow: ${({ $priority }) =>
      $priority === 'low' ? 'inset 0 0 0 1px var(--platform-colors-text-disabled)' : 'none'};
  }
`

export const CardMetaText = styled.span<{ $overdue?: boolean }>`
  color: ${({ $overdue }) =>
    $overdue ? 'var(--platform-colors-semantic-red-text)' : 'var(--platform-colors-text-secondary)'};
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-meta-size);
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.2;
`

export const CardLabelChip = styled.span`
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  color: var(--platform-colors-text-secondary);
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-meta-size);
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;

  &::before {
    color: var(--platform-colors-text-disabled);
    content: '· ';
  }
`

export const Avatar = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--platform-colors-border-strong);
  border-radius: 999px;
  background: var(--pure-chrome-well);
  color: var(--platform-colors-text-secondary);
  font-family: var(--platform-typography-font-family-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0;
  flex-shrink: 0;
`

export const CardActions = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  justify-content: flex-end;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;

  ${TaskCard}:hover &,
  ${TaskCard}:focus-within & {
    opacity: 1;
    pointer-events: auto;
  }
`

export const CardStepButton = styled(Button)`
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border-color: transparent;
  border-radius: var(--platform-radius-sm);
  background: var(--pure-chrome-paper);
  color: var(--platform-colors-text-secondary);
  box-shadow: 0 1px 2px rgb(28 26 23 / 8%);

  &:hover:not(:disabled) {
    background: var(--platform-colors-surface-hover);
    color: var(--platform-colors-text);
  }
`

export const ProgressTrack = styled.div`
  height: 6px;
  overflow: hidden;
  background: var(--platform-colors-surface-hover);
  border: 1px solid var(--platform-colors-border);
  border-radius: var(--platform-radius-sm);
`

export const ProgressFill = styled.div<{ $percent: number }>`
  width: ${({ $percent }) => `${$percent}%`};
  height: 100%;
  background: var(--platform-colors-accent);
  border-radius: inherit;
`

export const CompletedChecklistText = styled.span<{ $done?: boolean }>`
  color: ${({ $done }) =>
    $done
      ? 'var(--platform-colors-text-secondary)'
      : 'var(--platform-colors-text)'};
  text-decoration: ${({ $done }) => ($done ? 'line-through' : 'none')};
`

export const ListView = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  align-items: stretch;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: auto;
  padding: 0;
  background: var(--platform-colors-bg);
`

export const ListRow = styled.div<{ $selected?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 130px 120px 110px;
  gap: 16px;
  align-items: center;
  min-height: var(--puretasks-row-height);
  padding: 0 var(--pure-chrome-inset);
  border-bottom: 1px solid var(--pure-chrome-line);
  font-size: var(--pure-chrome-ui-size);
  border-left: 3px solid
    ${({ $selected }) =>
      $selected
        ? 'var(--pure-chrome-accent)'
        : 'transparent'};
  background: ${({ $selected }) =>
    $selected ? 'var(--pure-chrome-selection)' : 'transparent'};
  cursor: pointer;

  &:hover {
    background: var(--pure-chrome-hover);
  }
`

export const ViewPanel = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  align-items: stretch;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: auto;
  padding: 0;
  background: var(--platform-colors-bg);
`

export const ViewSection = styled.section`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 100%;
  width: 100%;
  overflow: hidden auto;
  padding-bottom: var(--platform-spacing-lg);
  border: 0;
  border-radius: 0;
  background: var(--platform-colors-surface);
  box-shadow: none;
`

export const ViewSectionTitle = styled.h2`
  margin: 0;
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-label-size);
  font-weight: 500;
  letter-spacing: var(--pure-chrome-label-tracking);
  text-transform: uppercase;
  color: var(--pure-chrome-muted);
`

export const StructuredViewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--platform-spacing-md);
  min-height: 42px;
  padding: 0 var(--pure-chrome-inset);
  border-bottom: 1px solid var(--pure-chrome-line);
`

export const StructuredTableHeader = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 130px 120px 110px;
  gap: 16px;
  align-items: center;
  min-height: 34px;
  padding: 0 var(--pure-chrome-inset);
  border-bottom: 1px solid var(--pure-chrome-line);
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-label-size);
  font-weight: 500;
  letter-spacing: var(--pure-chrome-label-tracking);
  text-transform: uppercase;
  color: var(--pure-chrome-muted);
`

export const CompactTaskRow = styled.button`
  display: grid;
  grid-template-columns:
    minmax(220px, 1.4fr) minmax(160px, 0.8fr) minmax(130px, 0.6fr)
    minmax(100px, 0.5fr);
  gap: 16px;
  align-items: center;
  min-height: var(--puretasks-row-height);
  padding: 0 var(--pure-chrome-inset);
  border: 0;
  border-bottom: 1px solid var(--pure-chrome-line);
  font-size: var(--pure-chrome-ui-size);
  background: transparent;
  color: var(--platform-colors-text);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--platform-colors-surface-hover);
  }
`

export const CompactTableHeader = styled.div`
  display: grid;
  grid-template-columns:
    minmax(220px, 1.4fr) minmax(160px, 0.8fr) minmax(130px, 0.6fr)
    minmax(100px, 0.5fr);
  gap: 16px;
  align-items: center;
  min-height: 34px;
  padding: 0 var(--pure-chrome-inset);
  border-bottom: 1px solid var(--pure-chrome-line);
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-label-size);
  font-weight: 500;
  letter-spacing: var(--pure-chrome-label-tracking);
  text-transform: uppercase;
  color: var(--pure-chrome-muted);
`

export const TaskCell = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`

export const DueText = styled.span`
  color: var(--platform-colors-text-secondary);
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--platform-typography-font-size-sm);
  font-weight: 600;
  letter-spacing: 0;
  white-space: nowrap;
`

export const TaskCompletionMark = styled.span<{ $done?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 2px solid
    ${({ $done }) =>
      $done
        ? 'var(--platform-colors-semantic-green-border)'
        : 'var(--platform-colors-border-strong)'};
  border-radius: var(--platform-radius-sm);
  background: ${({ $done }) =>
    $done ? 'var(--platform-colors-semantic-green-muted)' : 'transparent'};
  color: var(--platform-colors-semantic-green-text);
  font-size: 12px;
  font-weight: var(--platform-typography-font-weight-bold);
  line-height: 1;
  flex-shrink: 0;
`

export const PriorityDot = styled.span<{ $tone: SemanticChipTone }>`
  width: 8px;
  height: 8px;
  border-radius: var(--platform-radius-sm);
  background: ${({ $tone }) =>
    $tone === 'red'
      ? 'var(--platform-colors-semantic-red-text)'
      : $tone === 'green'
      ? 'var(--platform-colors-semantic-green-text)'
      : $tone === 'blue'
      ? 'var(--platform-colors-semantic-blue-text)'
      : 'var(--platform-colors-text-secondary)'};
  opacity: 0.7;
  flex-shrink: 0;
`

export const DotLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--platform-colors-text-secondary);
  font-size: var(--platform-typography-font-size-sm);
  font-weight: 600;
`

export const AgendaPanel = styled(ViewSection)`
  width: 100%;
`

export const ActivityFeed = styled(ViewSection)`
  width: 100%;
`

export const ActivityTableHeader = styled.div`
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) minmax(160px, 1fr) minmax(
      72px,
      120px
    );
  gap: 16px;
  align-items: center;
  min-height: 34px;
  padding: 0 var(--pure-chrome-inset);
  border-bottom: 1px solid var(--pure-chrome-line);
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-label-size);
  font-weight: 500;
  letter-spacing: var(--pure-chrome-label-tracking);
  text-transform: uppercase;
  color: var(--pure-chrome-muted);
`

export const ActivityTableRow = styled.button`
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) minmax(160px, 1fr) minmax(
      72px,
      120px
    );
  gap: 16px;
  align-items: center;
  min-height: var(--puretasks-row-height);
  padding: 0 var(--pure-chrome-inset);
  border: 0;
  border-bottom: 1px solid var(--pure-chrome-line);
  font-size: var(--pure-chrome-ui-size);
  background: transparent;
  color: var(--platform-colors-text);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--platform-colors-surface-hover);
  }
`

export const ActivityActorCell = styled.span`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

export const ActivityChangeCell = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--platform-colors-text-secondary);
`

export const ActivityWhenCell = styled.span`
  justify-self: end;
  color: var(--platform-colors-text-secondary);
  font-size: var(--platform-typography-font-size-sm);
  white-space: nowrap;
`

export const ResourceRow = styled.div`
  display: grid;
  grid-template-columns:
    minmax(220px, 1.2fr) minmax(220px, 1fr) minmax(100px, 0.4fr)
    minmax(80px, 0.3fr);
  gap: 16px;
  align-items: center;
  min-height: var(--puretasks-row-height);
  padding: 0 var(--pure-chrome-inset);
  border-bottom: 1px solid var(--pure-chrome-line);
  font-size: var(--pure-chrome-ui-size);
  background: transparent;
`

export const ResourceTableHeader = styled.div`
  display: grid;
  grid-template-columns:
    minmax(220px, 1.2fr) minmax(220px, 1fr) minmax(100px, 0.4fr)
    minmax(80px, 0.3fr);
  gap: 16px;
  align-items: center;
  min-height: 34px;
  padding: 0 var(--pure-chrome-inset);
  border-bottom: 1px solid var(--pure-chrome-line);
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-label-size);
  font-weight: 500;
  letter-spacing: var(--pure-chrome-label-tracking);
  text-transform: uppercase;
  color: var(--pure-chrome-muted);
`

export const StructuredEmptyRow = styled.div`
  display: flex;
  align-items: center;
  min-height: var(--puretasks-row-height);
  padding: 0 var(--pure-chrome-inset);
  border-bottom: 1px solid var(--pure-chrome-line);
  font-size: var(--pure-chrome-ui-size);
  color: var(--platform-colors-text-secondary);
`

export const LinkRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: var(--platform-spacing-xs);
  align-items: center;
  min-width: 0;
`
