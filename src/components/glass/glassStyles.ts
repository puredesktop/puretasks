import { styled } from 'styled-components'

/**
 * The glass look: frosted panels on the desk, near-solid cards so text stays
 * crisp. Every value is the shell's: the glass (`--glass-*`), the chrome
 * (`--pure-chrome-*`) and the semantic ramp (`--pure-success-*` and kin),
 * so a panel here frosts like a panel anywhere, in both themes.
 */
export const GlassShell = styled.div`
  --tasks-acc: var(--pure-chrome-accent);
  --tasks-acc-ink: color-mix(in oklab, var(--tasks-acc) 70%, var(--tasks-ink));
  --tasks-panel: var(--glass-panel);
  --tasks-panel-strong: var(--glass-panel-strong);
  --tasks-card: color-mix(in srgb, var(--pure-chrome-paper) 92%, transparent);
  --tasks-edge: var(--glass-edge);
  --tasks-edge-strong: var(--glass-edge-strong);
  --tasks-line: var(--glass-line);
  --tasks-well: var(--glass-well);
  --tasks-popover: var(--glass-popover);
  --tasks-blur: var(--glass-blur);
  --tasks-ink: var(--platform-colors-text);
  --tasks-muted: var(--pure-chrome-muted);
  --tasks-faint: var(--platform-colors-text-disabled);
  --tasks-mono: var(--platform-typography-font-family-mono);
  --tasks-ok-bg: var(--pure-success-muted); --tasks-ok-ink: var(--pure-success-text);
  --tasks-warn-bg: var(--pure-attention-muted); --tasks-warn-ink: var(--pure-attention-text);
  --tasks-bad-bg: var(--pure-danger-muted); --tasks-bad-ink: var(--pure-danger-text);
  --tasks-info-bg: var(--pure-info-muted); --tasks-info-ink: var(--pure-info-text);
  --tasks-ai-bg: color-mix(in srgb, var(--tasks-acc) 14%, var(--pure-chrome-paper)); --tasks-ai-ink: var(--tasks-acc-ink);

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  color: var(--tasks-ink);
  font-family: var(--platform-typography-font-family);

  :root[data-platform-theme='dark'] & {
    --tasks-card: color-mix(in srgb, var(--pure-chrome-paper) 88%, transparent);
  }

  /* Solid: the same tokens, flat values. Paper panels on the platform ground,
     hairline edges, no blur; nothing shows through. */
  &[data-appearance='solid'],
  :root[data-platform-theme='dark'] &[data-appearance='solid'] {
    --tasks-panel: var(--platform-colors-surface);
    --tasks-panel-strong: var(--pure-chrome-paper);
    --tasks-card: var(--pure-chrome-paper);
    --tasks-edge: var(--pure-chrome-line);
    --tasks-edge-strong: var(--platform-colors-border-strong);
    --tasks-line: var(--pure-chrome-line);
    --tasks-well: var(--pure-chrome-well);
    --tasks-popover: var(--pure-chrome-paper);
    --tasks-blur: none;
    background: var(--platform-colors-bg);
  }
`

export const TopBar = styled.div`
  /* Above the body: the bar's own frost makes a stacking context, and its
     popovers must paint over the frosted panels below. */
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  height: 48px;
  padding: 0 14px;
  border-bottom: 1px solid var(--tasks-edge);
  background: var(--tasks-panel);
  backdrop-filter: var(--tasks-blur);
  -webkit-backdrop-filter: var(--tasks-blur);
`

export const Wordmark = styled.span`
  font-size: 16px;
  letter-spacing: -0.01em;
  white-space: nowrap;
  strong { font-weight: 700; color: var(--tasks-acc); }
`

export const Pill = styled.button<{ $on?: boolean; $accent?: boolean; $quiet?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid ${({ $on, $accent }) => ($on || $accent ? 'transparent' : 'var(--tasks-line)')};
  background: ${({ $on, $accent, $quiet }) =>
    $accent ? 'var(--tasks-acc)' : $on ? 'var(--tasks-ink)' : $quiet ? 'transparent' : 'var(--tasks-panel-strong)'};
  color: ${({ $on, $accent }) => ($on || $accent ? 'var(--pure-chrome-on-accent)' : 'var(--tasks-ink)')};
  font: 500 12.5px var(--platform-typography-font-family);
  white-space: nowrap;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
  &:hover:not(:disabled) { border-color: var(--tasks-edge-strong); }
  &:disabled { opacity: 0.55; cursor: default; }
  &:focus-visible { outline: 2px solid var(--tasks-acc); outline-offset: 1px; }
  kbd { font-family: var(--tasks-mono); font-size: 10.5px; opacity: 0.75; }
`

export const ViewTabs = styled.div`
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--tasks-well);
`

export const ViewTab = styled.button<{ $on?: boolean }>`
  height: 28px;
  padding: 0 11px;
  border: 0;
  border-radius: 8px;
  background: ${({ $on }) => ($on ? 'var(--tasks-panel-strong)' : 'transparent')};
  color: ${({ $on }) => ($on ? 'var(--tasks-ink)' : 'var(--tasks-muted)')};
  font: ${({ $on }) => ($on ? '600' : '500')} 13px var(--platform-typography-font-family);
  box-shadow: ${({ $on }) => ($on ? '0 1px 2px rgba(16, 22, 40, 0.08)' : 'none')};
  cursor: pointer;
  &:focus-visible { outline: 2px solid var(--tasks-acc); outline-offset: 1px; }
`

export const SearchBox = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 260px;
  height: 30px;
  padding: 0 10px;
  border-radius: 9px;
  border: 1px solid var(--tasks-line);
  background: var(--tasks-panel-strong);
  color: var(--tasks-muted);
  font-size: 13px;
  input {
    flex: 1 1 auto;
    min-width: 0;
    border: 0;
    background: transparent;
    outline: none;
    font: inherit;
    color: var(--tasks-ink);
  }
  &:focus-within { border-color: var(--tasks-acc); }
`

export const Body = styled.div`
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
`

export const Rail = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  width: 208px;
  box-sizing: border-box;
  padding: 12px 10px;
  overflow: auto;
`

export const RailRow = styled.button<{ $on?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: ${({ $on }) => ($on ? 'var(--tasks-panel-strong)' : 'transparent')};
  color: var(--tasks-ink);
  font: ${({ $on }) => ($on ? '600' : '500')} 13px var(--platform-typography-font-family);
  text-align: left;
  cursor: pointer;
  box-shadow: ${({ $on }) => ($on ? '0 1px 2px rgba(16, 22, 40, 0.06)' : 'none')};
  &:hover { background: var(--tasks-panel); }
  &:focus-visible { outline: 2px solid var(--tasks-acc); outline-offset: 1px; }
  span.name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { font-family: var(--tasks-mono); font-size: 10.5px; color: var(--tasks-faint); }
`

export const RailDot = styled.span<{ $color?: string }>`
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $color }) => $color ?? 'var(--tasks-acc)'};
`

export const RailGroup = styled.div`
  padding: 14px 10px 6px;
  font-family: var(--tasks-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--tasks-faint);
`

export const Main = styled.main`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  padding: 12px 14px 0 4px;
`

export const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 30px;
`

export const Kicker = styled.span`
  font-family: var(--tasks-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--tasks-faint);
`

export const Divider = styled.span`
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--tasks-line);
`

export const Meta = styled.span`
  font-size: 12px;
  color: var(--tasks-muted);
`

export const BoardGrid = styled.div`
  display: flex;
  flex: 1 1 auto;
  gap: 12px;
  align-items: flex-start;
  min-height: 0;
  overflow: auto;
  padding: 0 0 12px;
`

export const Lane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`

export const LaneHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 6px 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--tasks-muted);
`

export const GlassColumn = styled.section<{ $over?: boolean; $refused?: boolean; $done?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  width: 250px;
  box-sizing: border-box;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid ${({ $over, $refused }) => ($refused ? 'var(--tasks-bad-ink)' : $over ? 'var(--tasks-acc)' : 'var(--tasks-edge)')};
  background: var(--tasks-panel);
  backdrop-filter: var(--tasks-blur);
  -webkit-backdrop-filter: var(--tasks-blur);
  opacity: ${({ $done }) => ($done ? 0.92 : 1)};
  transition: border-color 120ms ease;
`

export const ColumnHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 4px 4px;
  font-size: 13px;
  font-weight: 600;
  min-width: 0;
  .label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { font-family: var(--tasks-mono); font-size: 11px; color: var(--tasks-muted); font-weight: 400; }
`

export const ColumnTitleField = styled.input`
  flex: 1 1 auto;
  min-width: 0;
  height: 24px;
  padding: 0 6px;
  border-radius: 6px;
  border: 1px solid var(--tasks-acc);
  background: var(--tasks-card);
  font: 600 13px var(--platform-typography-font-family);
  color: var(--tasks-ink);
  outline: none;
`

export const Wip = styled.span<{ $full?: boolean }>`
  font-family: var(--tasks-mono);
  font-size: 10.5px;
  padding: 2px 7px;
  border-radius: 999px;
  background: ${({ $full }) => ($full ? 'var(--tasks-warn-bg)' : 'var(--tasks-well)')};
  color: ${({ $full }) => ($full ? 'var(--tasks-warn-ink)' : 'var(--tasks-muted)')};
  white-space: nowrap;
`

export const IconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--tasks-muted);
  cursor: pointer;
  &:hover { background: var(--tasks-well); color: var(--tasks-ink); }
  &:focus-visible { outline: 2px solid var(--tasks-acc); outline-offset: 1px; }
`

export const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 24px;
`

/** The drop zone below the last card: fixed height, so nothing moves under the pointer while dragging. */
export const DropSlot = styled.div<{ $active?: boolean }>`
  position: relative;
  min-height: 28px;
  flex: 1 1 auto;
  border-radius: 10px;
  background: ${({ $active }) => ($active ? 'color-mix(in srgb, var(--tasks-acc) 8%, transparent)' : 'transparent')};
  &::before {
    content: '';
    position: absolute;
    left: 6px;
    right: 6px;
    top: 0;
    height: 2px;
    border-radius: 1px;
    background: var(--tasks-acc);
    opacity: ${({ $active }) => ($active ? 1 : 0)};
  }
`

export const Card = styled.article<{ $selected?: boolean; $picked?: boolean; $dragging?: boolean; $blocked?: boolean; $done?: boolean; $drop?: 'before' | 'after' | null }>`
  position: relative;
  /* The drop line is drawn outside the card so the layout never shifts under the pointer. */
  ${({ $drop }) => $drop === 'before' ? `&::before { content: ''; position: absolute; left: 6px; right: 6px; top: -6px; height: 2px; border-radius: 1px; background: var(--tasks-acc); }` : $drop === 'after' ? `&::after { content: ''; position: absolute; left: 6px; right: 6px; bottom: -6px; height: 2px; border-radius: 1px; background: var(--tasks-acc); }` : ''}
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 12px 9px;
  border-radius: 12px;
  background: var(--tasks-card);
  border: 1px solid var(--tasks-edge);
  box-shadow: 0 1px 2px rgba(16, 22, 40, 0.06), 0 10px 22px -16px rgba(16, 22, 40, 0.35);
  cursor: grab;
  opacity: ${({ $dragging, $done }) => ($dragging ? 0.5 : $done ? 0.78 : 1)};
  outline: ${({ $selected, $picked }) => ($picked ? '2px solid var(--tasks-acc)' : $selected ? '2px solid color-mix(in srgb, var(--tasks-acc) 45%, transparent)' : '0')};
  outline-offset: -1px;
  transition: box-shadow 120ms ease, opacity 120ms ease;
  &:hover { box-shadow: 0 2px 4px rgba(16, 22, 40, 0.08), 0 14px 26px -14px rgba(16, 22, 40, 0.4); }
  &:active { cursor: grabbing; }
  &:focus-visible { outline: 2px solid var(--tasks-acc); outline-offset: -1px; }
  h4 {
    margin: 0;
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.35;
    text-wrap: pretty;
    overflow-wrap: anywhere;
    ${({ $done }) => ($done ? 'text-decoration: line-through; color: var(--tasks-muted);' : '')}
  }
`

export const CardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--tasks-muted);
`

export const Tag = styled.span<{ $tone?: 'pri' | 'due' | 'soon' | 'over' | 'blocked' | 'link' | 'ai' | 'ok' | 'wait' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 7px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  background: ${({ $tone }) =>
    $tone === 'pri' || $tone === 'soon' ? 'var(--tasks-warn-bg)'
    : $tone === 'over' || $tone === 'blocked' ? 'var(--tasks-bad-bg)'
    : $tone === 'link' ? 'var(--tasks-info-bg)'
    : $tone === 'ai' ? 'var(--tasks-ai-bg)'
    : $tone === 'ok' ? 'var(--tasks-ok-bg)'
    : 'var(--tasks-well)'};
  color: ${({ $tone }) =>
    $tone === 'pri' || $tone === 'soon' ? 'var(--tasks-warn-ink)'
    : $tone === 'over' || $tone === 'blocked' ? 'var(--tasks-bad-ink)'
    : $tone === 'link' ? 'var(--tasks-info-ink)'
    : $tone === 'ai' ? 'var(--tasks-ai-ink)'
    : $tone === 'ok' ? 'var(--tasks-ok-ink)'
    : 'var(--tasks-muted)'};
`

export const Avatar = styled.span<{ $hue?: number; $size?: number }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: ${({ $size }) => $size ?? 20}px;
  height: ${({ $size }) => $size ?? 20}px;
  border-radius: 50%;
  background: oklch(0.55 0.12 ${({ $hue }) => $hue ?? 260});
  color: #fff;
  font-size: ${({ $size }) => Math.round(($size ?? 20) * 0.48)}px;
  font-weight: 700;
  letter-spacing: 0.02em;
`

export const Progress = styled.div<{ $value: number; $tone?: 'ai' }>`
  height: 4px;
  flex: 1 1 auto;
  border-radius: 2px;
  background: var(--tasks-well);
  overflow: hidden;
  &::after {
    content: '';
    display: block;
    width: ${({ $value }) => Math.max(0, Math.min(100, $value))}%;
    height: 100%;
    background: ${({ $tone }) => ($tone === 'ai' ? 'var(--tasks-acc-ink)' : 'var(--tasks-acc)')};
    transition: width 200ms ease;
  }
`

export const AddRow = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 8px;
  border-radius: 9px;
  border: 1px dashed var(--tasks-edge-strong);
  background: transparent;
  font: 500 12.5px var(--platform-typography-font-family);
  color: var(--tasks-muted);
  cursor: pointer;
  &:hover:not(:disabled) { background: var(--tasks-panel-strong); color: var(--tasks-ink); }
  &:disabled { opacity: 0.6; cursor: default; }
`

export const QuickAdd = styled.form`
  display: flex;
  gap: 6px;
  input {
    flex: 1 1 auto;
    min-width: 0;
    height: 30px;
    padding: 0 10px;
    border-radius: 9px;
    border: 1px solid var(--tasks-acc);
    background: var(--tasks-card);
    font: 13px var(--platform-typography-font-family);
    color: var(--tasks-ink);
    outline: none;
  }
`

export const Popover = styled.div`
  position: fixed;
  z-index: 140;
  display: flex;
  flex-direction: column;
  gap: 1px;
  box-sizing: border-box;
  padding: 6px;
  border-radius: 12px;
  background: var(--tasks-popover);
  border: 1px solid var(--tasks-edge);
  backdrop-filter: var(--tasks-blur);
  -webkit-backdrop-filter: var(--tasks-blur);
  box-shadow: 0 18px 44px rgba(23, 26, 31, 0.22);
  color: var(--tasks-ink);
`

export const MenuItem = styled.button<{ $on?: boolean; $tone?: 'accent' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: ${({ $on }) => ($on ? 'color-mix(in srgb, var(--tasks-acc) 14%, transparent)' : 'transparent')};
  color: ${({ $tone }) => ($tone === 'danger' ? 'var(--tasks-bad-ink)' : $tone === 'accent' ? 'var(--tasks-acc-ink)' : 'var(--tasks-ink)')};
  font: ${({ $on }) => ($on ? '600' : '500')} 13px var(--platform-typography-font-family);
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  &:hover:not(:disabled) { background: var(--tasks-well); }
  &:disabled { opacity: 0.5; cursor: default; }
  kbd { margin-left: auto; padding-left: 14px; font-family: var(--tasks-mono); font-size: 10.5px; color: var(--tasks-faint); }
  small { margin-left: auto; padding-left: 14px; font-family: var(--tasks-mono); font-size: 10.5px; color: var(--tasks-warn-ink); }
`

export const MenuHead = styled.span`
  padding: 6px 10px 4px;
  font-family: var(--tasks-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--tasks-faint);
`

export const MenuRule = styled.span`
  height: 1px;
  margin: 4px 0;
  background: var(--tasks-line);
`

export const Toast = styled.div`
  position: fixed;
  left: 50%;
  bottom: 22px;
  z-index: 150;
  transform: translateX(-50%);
  padding: 8px 14px;
  border-radius: 10px;
  background: var(--tasks-ink);
  color: var(--platform-colors-text-inverse);
  font-size: 12.5px;
  box-shadow: 0 10px 30px rgba(23, 26, 31, 0.3);
`

export const SelectionBar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 8px 0 14px;
  border-radius: 12px;
  background: var(--tasks-popover);
  border: 1px solid var(--tasks-edge);
  box-shadow: 0 10px 30px rgba(23, 26, 31, 0.16);
  strong { font-size: 13px; margin-right: 6px; }
`

export const Pick = styled.label`
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: var(--tasks-card);
  border: 1px solid var(--tasks-line);
  cursor: pointer;
  input { width: 14px; height: 14px; margin: 0; accent-color: var(--tasks-acc); }
`

/* ── Card overlay ─────────────────────────────────────────────────────── */

export const OverlayBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 24px 24px;
  background: color-mix(in srgb, var(--platform-colors-text) 18%, transparent);
`

export const OverlayPanel = styled.div`
  display: flex;
  flex-direction: column;
  width: min(980px, 100%);
  max-height: calc(100% - 24px);
  box-sizing: border-box;
  border-radius: 18px;
  border: 1px solid var(--tasks-edge);
  background: var(--tasks-panel-strong);
  backdrop-filter: var(--tasks-blur);
  -webkit-backdrop-filter: var(--tasks-blur);
  box-shadow: 0 30px 80px rgba(23, 26, 31, 0.28);
  overflow: hidden;
  color: var(--tasks-ink);
`

export const OverlayTop = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 0;
  font-family: var(--tasks-mono);
  font-size: 11px;
  color: var(--tasks-muted);
  .hint { margin-left: auto; font-size: 10.5px; color: var(--tasks-faint); }
`

export const OverlayGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  flex: 1 1 auto;
  min-height: 0;
  @media (max-width: 900px) { grid-template-columns: minmax(0, 1fr); }
`

export const OverlayMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  padding: 10px 22px 20px;
  overflow: auto;
`

export const OverlaySide = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 18px 20px 16px;
  border-left: 1px solid var(--tasks-edge);
  background: color-mix(in srgb, var(--pure-chrome-paper) 35%, transparent);
  overflow: auto;
`

export const OverlayTitle = styled.h2`
  margin: 0;
  font-family: var(--platform-typography-font-family-content);
  font-size: 23px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.2;
`

export const TitleInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 2px 4px;
  margin: -2px -4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-family: var(--platform-typography-font-family-content);
  font-size: 23px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.2;
  color: var(--tasks-ink);
  outline: none;
  &:focus { background: var(--tasks-card); box-shadow: 0 0 0 2px var(--tasks-acc); }
`

export const DoneRing = styled.button<{ $done?: boolean }>`
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  margin-top: 3px;
  border-radius: 50%;
  border: 2px solid var(--tasks-acc);
  background: ${({ $done }) => ($done ? 'var(--tasks-acc)' : 'transparent')};
  color: var(--pure-chrome-on-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  &:focus-visible { outline: 2px solid var(--tasks-acc); outline-offset: 2px; }
`

export const Stepper = styled.div`
  display: flex;
  font-size: 12px;
  button {
    padding: 5px 12px;
    border: 0;
    background: var(--tasks-well);
    color: var(--tasks-muted);
    font: 500 12px var(--platform-typography-font-family);
    cursor: pointer;
    &:first-child { border-radius: 999px 0 0 999px; }
    &:last-child { border-radius: 0 999px 999px 0; }
    &[data-past='true'] { background: color-mix(in srgb, var(--tasks-acc) 20%, transparent); color: var(--tasks-acc-ink); }
    &[data-on='true'] { background: var(--tasks-acc); color: var(--pure-chrome-on-accent); font-weight: 600; }
    &:disabled { cursor: default; }
  }
`

export const SectionTitle = styled.h3`
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--tasks-muted);
`

export const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  a, button.link { margin-left: auto; padding: 0; border: 0; background: none; font: 500 12px var(--platform-typography-font-family); color: var(--tasks-acc-ink); cursor: pointer; }
`

export const Field = styled.div`
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 7px 0;
  border-top: 1px solid var(--tasks-line);
  font-size: 13px;
  &:first-of-type { border-top: 0; }
  > b { font-weight: 500; font-size: 12px; color: var(--tasks-muted); }
  &[data-stack='true'] { grid-template-columns: 1fr; }
`

export const FieldInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  height: 28px;
  padding: 0 8px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  font: 13px var(--platform-typography-font-family);
  color: var(--tasks-ink);
  outline: none;
  &:hover { background: var(--tasks-well); }
  &:focus { background: var(--tasks-card); border-color: var(--tasks-acc); }
`

export const FieldSelect = styled.select`
  height: 28px;
  padding: 0 6px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  font: 13px var(--platform-typography-font-family);
  color: var(--tasks-ink);
  cursor: pointer;
  &:hover { background: var(--tasks-well); }
  &:focus { background: var(--tasks-card); border-color: var(--tasks-acc); outline: none; }
`

export const SubtaskRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 10px;
  background: var(--tasks-card);
  border: 1px solid var(--tasks-line);
  font-size: 13px;
  cursor: pointer;
  .status { margin-left: auto; font-family: var(--tasks-mono); font-size: 10.5px; color: var(--tasks-muted); }
  &:hover { border-color: var(--tasks-edge-strong); }
`

export const Prose = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  min-height: 72px;
  padding: 8px 10px;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  font: 14px/1.55 var(--platform-typography-font-family);
  color: var(--tasks-ink);
  resize: vertical;
  outline: none;
  &:hover { background: var(--tasks-well); }
  &:focus { background: var(--tasks-card); border-color: var(--tasks-acc); }
`

/* ── Cross-board places ──────────────────────────────────────────────── */

export const PlaceTitle = styled.h1`
  margin: 0;
  font-family: var(--platform-typography-font-family-content);
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.01em;
`

export const ListRowGlass = styled.div<{ $muted?: boolean }>`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 9px 12px;
  border-radius: 12px;
  background: var(--tasks-card);
  border: 1px solid var(--tasks-edge);
  box-shadow: 0 1px 2px rgba(16, 22, 40, 0.05);
  opacity: ${({ $muted }) => ($muted ? 0.8 : 1)};
  input[type='checkbox'] { width: 18px; height: 18px; margin: 0; accent-color: var(--tasks-acc); }
  b { font-size: 13.5px; font-weight: 600; }
  .m { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11.5px; color: var(--tasks-muted); margin-top: 2px; }
`

export const SectionRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 8px 0 2px;
  h3 { margin: 0; font-size: 13px; font-weight: 700; }
  span { font-family: var(--tasks-mono); font-size: 11px; color: var(--tasks-muted); }
`

export const BoardCard = styled.button`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px 14px;
  border-radius: 16px;
  border: 1px solid var(--tasks-edge);
  background: var(--tasks-panel);
  backdrop-filter: var(--tasks-blur);
  -webkit-backdrop-filter: var(--tasks-blur);
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  &:hover { background: var(--tasks-panel-strong); }
  &:focus-visible { outline: 2px solid var(--tasks-acc); outline-offset: 1px; }
  h3 { margin: 0; font-family: var(--platform-typography-font-family-content); font-size: 18px; font-weight: 600; line-height: 1.2; }
  .stat { display: flex; gap: 14px; font-size: 12px; color: var(--tasks-muted); }
  .stat b { display: block; font-size: 17px; font-weight: 600; color: var(--tasks-ink); font-variant-numeric: tabular-nums; }
`

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th { text-align: left; font-family: var(--tasks-mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--tasks-faint); font-weight: 500; padding: 8px 10px; border-bottom: 1px solid var(--tasks-line); white-space: nowrap; }
  td { padding: 8px 10px; border-bottom: 1px solid var(--tasks-line); font-size: 13px; vertical-align: middle; }
  tr.group td { padding: 14px 10px 6px; border-bottom: 0; font-weight: 700; }
  tr.group td span { font-family: var(--tasks-mono); font-size: 11px; color: var(--tasks-muted); font-weight: 400; margin-left: 8px; }
  tr.row { cursor: pointer; }
  tr.row:hover td { background: var(--tasks-well); }
  td.t { font-weight: 600; }
`
