# puretasks roadmap

## Scope

Keep boards, columns, task details and existing work queues, resource links and mission integration.

These are proposed, incremental improvements, not a release schedule or a list of missing core features. Keep each change small and preserve existing file formats, user data and app workflows.

## Improvements

1. **Long task title wrapping.** Wrap task titles consistently in board cards, list rows and the detail overlay without hiding status or owner controls.

2. **Empty title feedback.** Prevent whitespace-only task titles with a clear inline message while preserving the rest of the task draft.

3. **Accessible checklist progress feedback.** Announce changes to the existing checklist completion count to assistive technology without moving focus away from the checkbox being edited.

4. **Checklist keyboard entry.** After adding an item, retain focus in the input for another entry and provide an explicit way to finish without adding a blank item.

5. **Checklist rename validation.** Explain blank checklist names next to the rename field and preserve the previous name until a valid edit is committed.

6. **Due-date exact context.** Show the exact date alongside relative due labels and distinguish an undated task from an overdue one.

7. **Owner picker disambiguation.** Show existing contact context beside identical owner names in the picker without changing task ownership semantics.

8. **Owner clear action label.** Make removing an owner explicit in the picker and distinguish it from choosing the current user.

9. **Tag whitespace handling.** Trim incidental whitespace in tag entry and avoid adding the same tag twice to a task.

10. **Active filter summary.** Show which owner, status or tag filters are active and offer a clear-all action when a board appears empty.

11. **Column task counts.** Show visible and total task counts when filtering a column so hidden tasks are not mistaken for deleted work.

12. **Empty column guidance.** Provide a short prompt and the existing add-task action in an empty column, using that column as the default destination.

13. **Task move feedback.** After a status or column change, briefly name the destination and keep a way to reopen the moved task if it leaves the current filter.

14. **Linked resource labels.** Show resource type and the full destination on focus so similarly named files or app resources can be distinguished.

15. **Broken resource feedback.** Explain whether a linked resource is missing or its app is unavailable while retaining the task and link for correction.

16. **Comment edit state.** Make editing an existing comment visually distinct from composing a new one, with clear save and cancel controls.

17. **Comment timestamp detail.** Expose exact creation and edit timestamps without overloading the compact activity stream.

18. **Activity filter empty states.** Distinguish no recorded activity from no matches for the selected activity filter and offer a reset action.

19. **Board deletion context.** In the existing board-delete flow, show the board name and task count and make permanent package deletion explicit.

20. **Mission launch result clarity.** After the existing create-mission action, show the resulting mission reference or a concrete failure reason without implying work has already completed.

## References

- [App guide](docs/app-guide.md)
- [Development guide](docs/development.md)
- [Current implementation](src/components/TaskCardInfoModal.tsx)
