---
name: create-prd
description: Create or update repository PRD Markdown files using the numbering and required sections in AGENTS.md. Use when drafting requirements or revising an existing PRD.
---

# Create or update a PRD

Read the repository root `AGENTS.md` and any applicable directory instructions before writing. Its PRD conventions are the source of truth. In this project, `pg` means payment gateway.

## Choose the document

- For an update, read the specified PRD and preserve its number, filename, and relevant existing requirements. If no file is specified, inspect existing PRDs to identify the matching document; ask only if the target remains ambiguous.
- For a new PRD, use `.prds/`, the existing repository PRD directory. Inspect existing filenames and assign the next number after the highest existing numeric prefix, padded to at least four digits. Use a descriptive kebab-case filename such as `0002-payment-gateway.md`. Do not fill numbering gaps or overwrite an existing file.
- Create a new document when requested; update an existing document when requested. Do not renumber unrelated PRDs.

## Write the requirements

- When documenting changes to existing behavior, inspect the relevant
  implementation and use its terminology. Apply the `AGENTS.md` “Code as
  input” rule when implementation is part of the task.

Use these sections in this order, with substantive content appropriate to the request:

```markdown
# NNNN — PRD title

## Description
Overview and summary of the requested change.

## Problem Description
The problem and why this PRD is needed.

## Implementation Plan
Concrete steps to deliver the requested behavior.

## What Success Outcome Looks Like
Observable, verifiable acceptance criteria.

## Dependencies
Other PRDs that must be completed first, or None.

## Assumptions
Explicit assumptions that affect scope or behavior, or None.
```

Read relevant repository documents or code when needed to ground the plan in the current system. Distinguish proposed changes from existing behavior. Keep scope aligned with the user's request; drafting a PRD does not authorize implementing it.

Reference prerequisite PRDs by their actual filenames using relative Markdown links. Do not invent dependency numbers or assert unverified prerequisites. Record reasonable unresolved choices under Assumptions; ask for clarification when missing information prevents a useful, accurate PRD.

For updates, revise affected sections together so the problem, plan, acceptance criteria, dependencies, and assumptions remain consistent. Preserve unrelated content and user edits.

Before finishing, verify the `.md` extension, four-digit minimum numeric prefix, all six required sections, and any dependency links. For a new PRD, recheck that the chosen number is still available before writing. Report the created or updated file with a concise summary of the change.
