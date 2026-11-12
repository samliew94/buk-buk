# Acronyms
pg = payment gateway
txn = transaction

# Handling API errors
when throwing errors, throw in this format example:
```bash
throw new NotFoundError('business not found | id: ' + c.req.param('id'))
```

# Updating and Jotting down thoughts
`.docs/DIARY.md` is a file containing my (_developer_) thoughts on various ideas/tasks/issues pertaining to the system.

Read this before implementing anything.

Update this after implementing something pertaining to the notes.

The diary contains:
- history of decisions prompted by the agent and may or may not be decided by the developer yet
- important remarks that seems to be `passing notes` but is actually critical, eg:
  - _'We are still developing for MVP. Concurrency not important to be handled at present...'_







