# Acronyms
pg = payment gateway
txn = transaction

# Ticket references
When the input is `NNNN` (a four-digit number), treat it as a ticket number referring to the matching file in `.prds/*`.

# Handling API errors
when throwing errors, throw in this format example:
```bash
throw new NotFoundError('business not found | id: ' + c.req.param('id'))
```

# Local production preview
When giving developers preview instructions, remind them to build the app before starting preview. Show the build command first. For admin, run `pnpm --filter admin build` before the preview command. Rebuild after source changes so preview serves the latest code.

# Updating and Jotting down thoughts
`.docs/DIARY.md` is a file containing my (_developer_) thoughts on various ideas/tasks/issues pertaining to the system.

Read this before implementing anything.

Update this after implementing something pertaining to the notes.

The diary contains:
- history of decisions prompted by the agent and may or may not be decided by the developer yet
- important remarks that seems to be `passing notes` but is actually critical, eg:
  - _'We are still developing for MVP. Concurrency not important to be handled at present...'_







