import { useEffect, useState } from 'react'
import { styled } from 'styled-components'
import {
  suggestPeople,
  type PersonSuggestion,
} from '../../bridge/platformBridge'
import { FieldInput } from './glassStyles'

export function OwnerPicker({
  value,
  onChange,
  onCommit,
}: {
  value: string
  onChange: (value: string) => void
  onCommit: (value: string) => void
}): React.ReactElement {
  const [people, setPeople] = useState<PersonSuggestion[]>([])
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const query = value.trim()
    if (!open || query.length < 2) {
      setPeople([])
      return
    }
    let live = true
    const timer = window.setTimeout(() => {
      void suggestPeople(query).then(found => {
        if (!live) return
        setPeople(found)
        setActive(0)
      })
    }, 160)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [open, value])

  const pick = (person: PersonSuggestion): void => {
    onChange(person.name)
    onCommit(person.name)
    setPeople([])
    setOpen(false)
  }

  return (
    <Picker>
      <FieldInput
        aria-autocomplete="list"
        aria-controls="task-owner-suggestions"
        aria-expanded={open && people.length > 0}
        aria-label="Owner"
        placeholder="Find someone in People"
        role="combobox"
        value={value}
        onBlur={() => {
          setOpen(false)
          onCommit(value)
        }}
        onChange={event => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={event => {
          if (people.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault()
            setActive(index => (index + (event.key === 'ArrowDown' ? 1 : people.length - 1)) % people.length)
            return
          }
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            setOpen(false)
            return
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            if (people[active]) pick(people[active])
            else event.currentTarget.blur()
          }
        }}
      />
      {open && people.length ? (
        <Suggestions id="task-owner-suggestions" role="listbox" aria-label="People">
          {people.map((person, index) => (
            <button
              key={`${person.providerId}:${person.email ?? person.name}`}
              type="button"
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onMouseDown={event => {
                event.preventDefault()
                pick(person)
              }}
            >
              <strong>{person.name}</strong>
              {person.email ? <span>{person.email}</span> : null}
            </button>
          ))}
          <small>From {people[0]?.sourceLabel || 'People'}</small>
        </Suggestions>
      ) : null}
    </Picker>
  )
}

const Picker = styled.span`
  position: relative;
  display: block;
  min-width: 0;
  flex: 1 1 auto;
`

const Suggestions = styled.span`
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 160;
  display: flex;
  flex-direction: column;
  width: max(100%, 220px);
  box-sizing: border-box;
  padding: 4px;
  border: 1px solid var(--tasks-edge);
  border-radius: 10px;
  background: var(--tasks-popover);
  box-shadow: 0 14px 34px rgba(23, 26, 31, 0.2);

  button {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 7px 9px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--tasks-ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  button[aria-selected='true'] { background: var(--tasks-well); }
  strong { font-size: 12.5px; font-weight: 600; }
  span { overflow: hidden; color: var(--tasks-muted); font-size: 11.5px; text-overflow: ellipsis; }
  small { padding: 5px 9px 3px; color: var(--tasks-faint); font-size: 10.5px; }
`
