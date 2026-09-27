# puretasks contribution roadmap

Build something you can see and try in the app. The first five items are **good first contributions**: bounded changes with a concrete demonstration. Choose a feature below, fix a bug, or propose your own improvement.

## Scope

Keep boards, columns, task details and existing work queues, resource links and mission integration.

Size describes scope, not a promised completion time: **Small** = one focused interface change; **Medium** = coordinated interface/state work; **Large** = a feature across several flows, storage or export paths. All items are proposals, not claims that existing features are absent. Check the current code and extend what is there. Maintainers review code and tests before merging. Attribution is your choice.

## Good first contributions

1. **See visible and total tasks per column.** Show visible and total task counts when filtering a column so hidden tasks are not mistaken for deleted work.
   <!-- contribution: {"id": "column-task-counts", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/column-task-counts.md"} -->
   [Small · Good first contribution · Implementation brief](docs/contributions/column-task-counts.md)

2. **Add a task from an empty column.** Provide a short prompt and the existing add-task action in an empty column, using that column as the default destination.
   <!-- contribution: {"id": "empty-column-guidance", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/empty-column-guidance.md"} -->
   [Small · Good first contribution · Implementation brief](docs/contributions/empty-column-guidance.md)

3. **See the exact task due date.** Show the exact date alongside relative due labels and distinguish an undated task from an overdue one.
   <!-- contribution: {"id": "due-date-exact-context", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/due-date-exact-context.md"} -->
   [Small · Good first contribution · Implementation brief](docs/contributions/due-date-exact-context.md)

4. **Read long task titles.** Wrap task titles consistently in board cards, list rows and the detail overlay without hiding status or owner controls.
   <!-- contribution: {"id": "long-task-title-wrapping", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/long-task-title-wrapping.md"} -->
   [Small · Good first contribution · Implementation brief](docs/contributions/long-task-title-wrapping.md)

5. **Add checklist items without leaving the keyboard.** After adding an item, retain focus in the input for another entry and provide an explicit way to finish without adding a blank item.
   <!-- contribution: {"id": "checklist-keyboard-entry", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/checklist-keyboard-entry.md"} -->
   [Small · Good first contribution · Implementation brief](docs/contributions/checklist-keyboard-entry.md)

## More improvements

6. **Correct an empty task title.** Prevent whitespace-only task titles with a clear inline message while preserving the rest of the task draft.
   <!-- contribution: {"id": "empty-title-feedback", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/empty-title-feedback.md"} -->
   [Medium · Implementation brief](docs/contributions/empty-title-feedback.md)

7. **Hear checklist progress updates.** Announce changes to the existing checklist completion count to assistive technology without moving focus away from the checkbox being edited.
   <!-- contribution: {"id": "accessible-checklist-progress-feedback", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/accessible-checklist-progress-feedback.md"} -->
   [Medium · Implementation brief](docs/contributions/accessible-checklist-progress-feedback.md)

8. **Correct a checklist name.** Explain blank checklist names next to the rename field and preserve the previous name until a valid edit is committed.
   <!-- contribution: {"id": "checklist-rename-validation", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/checklist-rename-validation.md"} -->
   [Medium · Implementation brief](docs/contributions/checklist-rename-validation.md)

9. **Tell same-named owners apart.** Show existing contact context beside identical owner names in the picker without changing task ownership semantics.
   <!-- contribution: {"id": "owner-picker-disambiguation", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/owner-picker-disambiguation.md"} -->
   [Medium · Implementation brief](docs/contributions/owner-picker-disambiguation.md)

10. **Clear an owner explicitly.** Make removing an owner explicit in the picker and distinguish it from choosing the current user.
   <!-- contribution: {"id": "owner-clear-action-label", "size": "small", "goodFirstIssue": false, "guide": "docs/contributions/owner-clear-action-label.md"} -->
   [Small · Implementation brief](docs/contributions/owner-clear-action-label.md)

11. **Avoid duplicate task tags.** Trim incidental whitespace in tag entry and avoid adding the same tag twice to a task.
   <!-- contribution: {"id": "tag-whitespace-handling", "size": "small", "goodFirstIssue": false, "guide": "docs/contributions/tag-whitespace-handling.md"} -->
   [Small · Implementation brief](docs/contributions/tag-whitespace-handling.md)

12. **Clear filters hiding your tasks.** Show which owner, status or tag filters are active and offer a clear-all action when a board appears empty.
   <!-- contribution: {"id": "active-filter-summary", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/active-filter-summary.md"} -->
   [Medium · Implementation brief](docs/contributions/active-filter-summary.md)

13. **Find a task after moving it.** After a status or column change, briefly name the destination and keep a way to reopen the moved task if it leaves the current filter.
   <!-- contribution: {"id": "task-move-feedback", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/task-move-feedback.md"} -->
   [Medium · Implementation brief](docs/contributions/task-move-feedback.md)

14. **Tell linked resources apart.** Show resource type and the full destination on focus so similarly named files or app resources can be distinguished.
   <!-- contribution: {"id": "linked-resource-labels", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/linked-resource-labels.md"} -->
   [Medium · Implementation brief](docs/contributions/linked-resource-labels.md)

15. **Understand a broken task link.** Explain whether a linked resource is missing or its app is unavailable while retaining the task and link for correction.
   <!-- contribution: {"id": "broken-resource-feedback", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/broken-resource-feedback.md"} -->
   [Medium · Implementation brief](docs/contributions/broken-resource-feedback.md)

16. **Know when you are editing a comment.** Make editing an existing comment visually distinct from composing a new one, with clear save and cancel controls.
   <!-- contribution: {"id": "comment-edit-state", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/comment-edit-state.md"} -->
   [Medium · Implementation brief](docs/contributions/comment-edit-state.md)

17. **See exact comment times.** Expose exact creation and edit timestamps without overloading the compact activity stream.
   <!-- contribution: {"id": "comment-timestamp-detail", "size": "small", "goodFirstIssue": false, "guide": "docs/contributions/comment-timestamp-detail.md"} -->
   [Small · Implementation brief](docs/contributions/comment-timestamp-detail.md)

18. **Reset an empty activity filter.** Distinguish no recorded activity from no matches for the selected activity filter and offer a reset action.
   <!-- contribution: {"id": "activity-filter-empty-states", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/activity-filter-empty-states.md"} -->
   [Medium · Implementation brief](docs/contributions/activity-filter-empty-states.md)

19. **Check what deleting a board removes.** In the existing board-delete flow, show the board name and task count and make permanent package deletion explicit.
   <!-- contribution: {"id": "board-deletion-context", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/board-deletion-context.md"} -->
   [Medium · Implementation brief](docs/contributions/board-deletion-context.md)

20. **See whether a mission was actually created.** After the existing create-mission action, show the resulting mission reference or a concrete failure reason without implying work has already completed.
   <!-- contribution: {"id": "mission-launch-result-clarity", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/mission-launch-result-clarity.md"} -->
   [Medium · Implementation brief](docs/contributions/mission-launch-result-clarity.md)

21. **Save named board filter views.** Let users save the existing owner, status and tag filters as named views, reopen them and update or remove them. Store filter definitions, not duplicate tasks.
   <!-- contribution: {"id": "save-named-board-filter-views", "size": "large", "goodFirstIssue": false, "guide": "docs/contributions/save-named-board-filter-views.md"} -->
   [Large · Implementation brief](docs/contributions/save-named-board-filter-views.md)

## References

- [Contribution brief index](docs/contributions/README.md)
- [App guide](docs/app-guide.md)
- [Development guide](docs/development.md)
- [Contributing](CONTRIBUTING.md)
