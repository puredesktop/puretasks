# puretasks contribution roadmap

[View roadmap issues](https://github.com/puredesktop/puretasks/issues?q=is%3Aissue%20label%3Aroadmap)

Build something you can see and try in the app. The first five items are **good first contributions**: bounded changes with a concrete demonstration. Choose a feature below, fix a bug, or propose your own improvement.

## Scope

Keep boards, columns, task details and existing work queues, resource links and mission integration.

Size describes scope, not a promised completion time: **Small** = one focused interface change; **Medium** = coordinated interface/state work; **Large** = a feature across several flows, storage or export paths. All items are proposals, not claims that existing features are absent. Check the current code and extend what is there. Maintainers review code and tests before merging. Attribution is your choice.

## Good first contributions

1. **[See visible and total tasks per column.](https://github.com/puredesktop/puretasks/issues/3)** Show visible and total task counts when filtering a column so hidden tasks are not mistaken for deleted work.
   <!-- contribution: {"id": "column-task-counts", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/column-task-counts.md"} -->
   [Small · Good first contribution · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/column-task-counts.md)

2. **[Add a task from an empty column.](https://github.com/puredesktop/puretasks/issues/4)** Provide a short prompt and the existing add-task action in an empty column, using that column as the default destination.
   <!-- contribution: {"id": "empty-column-guidance", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/empty-column-guidance.md"} -->
   [Small · Good first contribution · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/empty-column-guidance.md)

3. **[See the exact task due date.](https://github.com/puredesktop/puretasks/issues/5)** Show the exact date alongside relative due labels and distinguish an undated task from an overdue one.
   <!-- contribution: {"id": "due-date-exact-context", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/due-date-exact-context.md"} -->
   [Small · Good first contribution · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/due-date-exact-context.md)

4. **[Read long task titles.](https://github.com/puredesktop/puretasks/issues/6)** Wrap task titles consistently in board cards, list rows and the detail overlay without hiding status or owner controls.
   <!-- contribution: {"id": "long-task-title-wrapping", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/long-task-title-wrapping.md"} -->
   [Small · Good first contribution · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/long-task-title-wrapping.md)

5. **[Add checklist items without leaving the keyboard.](https://github.com/puredesktop/puretasks/issues/7)** After adding an item, retain focus in the input for another entry and provide an explicit way to finish without adding a blank item.
   <!-- contribution: {"id": "checklist-keyboard-entry", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/checklist-keyboard-entry.md"} -->
   [Small · Good first contribution · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/checklist-keyboard-entry.md)

## More improvements

6. **[Correct an empty task title.](https://github.com/puredesktop/puretasks/issues/8)** Prevent whitespace-only task titles with a clear inline message while preserving the rest of the task draft.
   <!-- contribution: {"id": "empty-title-feedback", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/empty-title-feedback.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/empty-title-feedback.md)

7. **[Hear checklist progress updates.](https://github.com/puredesktop/puretasks/issues/9)** Announce changes to the existing checklist completion count to assistive technology without moving focus away from the checkbox being edited.
   <!-- contribution: {"id": "accessible-checklist-progress-feedback", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/accessible-checklist-progress-feedback.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/accessible-checklist-progress-feedback.md)

8. **[Correct a checklist name.](https://github.com/puredesktop/puretasks/issues/10)** Explain blank checklist names next to the rename field and preserve the previous name until a valid edit is committed.
   <!-- contribution: {"id": "checklist-rename-validation", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/checklist-rename-validation.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/checklist-rename-validation.md)

9. **[Tell same-named owners apart.](https://github.com/puredesktop/puretasks/issues/11)** Show existing contact context beside identical owner names in the picker without changing task ownership semantics.
   <!-- contribution: {"id": "owner-picker-disambiguation", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/owner-picker-disambiguation.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/owner-picker-disambiguation.md)

10. **[Clear an owner explicitly.](https://github.com/puredesktop/puretasks/issues/12)** Make removing an owner explicit in the picker and distinguish it from choosing the current user.
   <!-- contribution: {"id": "owner-clear-action-label", "size": "small", "goodFirstIssue": false, "guide": "docs/contributions/owner-clear-action-label.md"} -->
   [Small · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/owner-clear-action-label.md)

11. **[Avoid duplicate task tags.](https://github.com/puredesktop/puretasks/issues/13)** Trim incidental whitespace in tag entry and avoid adding the same tag twice to a task.
   <!-- contribution: {"id": "tag-whitespace-handling", "size": "small", "goodFirstIssue": false, "guide": "docs/contributions/tag-whitespace-handling.md"} -->
   [Small · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/tag-whitespace-handling.md)

12. **[Clear filters hiding your tasks.](https://github.com/puredesktop/puretasks/issues/14)** Show which owner, status or tag filters are active and offer a clear-all action when a board appears empty.
   <!-- contribution: {"id": "active-filter-summary", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/active-filter-summary.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/active-filter-summary.md)

13. **[Find a task after moving it.](https://github.com/puredesktop/puretasks/issues/15)** After a status or column change, briefly name the destination and keep a way to reopen the moved task if it leaves the current filter.
   <!-- contribution: {"id": "task-move-feedback", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/task-move-feedback.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/task-move-feedback.md)

14. **[Tell linked resources apart.](https://github.com/puredesktop/puretasks/issues/16)** Show resource type and the full destination on focus so similarly named files or app resources can be distinguished.
   <!-- contribution: {"id": "linked-resource-labels", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/linked-resource-labels.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/linked-resource-labels.md)

15. **[Understand a broken task link.](https://github.com/puredesktop/puretasks/issues/17)** Explain whether a linked resource is missing or its app is unavailable while retaining the task and link for correction.
   <!-- contribution: {"id": "broken-resource-feedback", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/broken-resource-feedback.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/broken-resource-feedback.md)

16. **[Know when you are editing a comment.](https://github.com/puredesktop/puretasks/issues/18)** Make editing an existing comment visually distinct from composing a new one, with clear save and cancel controls.
   <!-- contribution: {"id": "comment-edit-state", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/comment-edit-state.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/comment-edit-state.md)

17. **[See exact comment times.](https://github.com/puredesktop/puretasks/issues/19)** Expose exact creation and edit timestamps without overloading the compact activity stream.
   <!-- contribution: {"id": "comment-timestamp-detail", "size": "small", "goodFirstIssue": false, "guide": "docs/contributions/comment-timestamp-detail.md"} -->
   [Small · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/comment-timestamp-detail.md)

18. **[Reset an empty activity filter.](https://github.com/puredesktop/puretasks/issues/20)** Distinguish no recorded activity from no matches for the selected activity filter and offer a reset action.
   <!-- contribution: {"id": "activity-filter-empty-states", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/activity-filter-empty-states.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/activity-filter-empty-states.md)

19. **[Check what deleting a board removes.](https://github.com/puredesktop/puretasks/issues/21)** In the existing board-delete flow, show the board name and task count and make permanent package deletion explicit.
   <!-- contribution: {"id": "board-deletion-context", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/board-deletion-context.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/board-deletion-context.md)

20. **[See whether a mission was actually created.](https://github.com/puredesktop/puretasks/issues/22)** After the existing create-mission action, show the resulting mission reference or a concrete failure reason without implying work has already completed.
   <!-- contribution: {"id": "mission-launch-result-clarity", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/mission-launch-result-clarity.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/mission-launch-result-clarity.md)

21. **[Save named board filter views.](https://github.com/puredesktop/puretasks/issues/23)** Let users save the existing owner, status and tag filters as named views, reopen them and update or remove them. Store filter definitions, not duplicate tasks.
   <!-- contribution: {"id": "save-named-board-filter-views", "size": "large", "goodFirstIssue": false, "guide": "docs/contributions/save-named-board-filter-views.md"} -->
   [Large · Implementation brief](https://github.com/puredesktop/puretasks/blob/main/docs/contributions/save-named-board-filter-views.md)

## References

- [App guide](https://github.com/puredesktop/puretasks/blob/main/docs/app-guide.md)
- [Development guide](https://github.com/puredesktop/puretasks/blob/main/docs/development.md)
- [Contributing](https://github.com/puredesktop/puretasks/blob/main/CONTRIBUTING.md)
