import { URL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
export function fixture(beforeCategoryMigration = false) {
  // Site-specific configuration migrations (0014+) require ST3 seed data.
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  const dir = new URL('../migrations/', import.meta.url)
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith('.sql') && n < '0014')
    .sort()) {
    if (beforeCategoryMigration && name.startsWith('0013')) continue
    db.exec(readFileSync(new URL(name, dir), 'utf8'))
  }
  const d1 = {
    prepare(sql: string) {
      return {
        bind(...values: (string | number | null)[]) {
          return {
            async first() {
              const row = db.prepare(sql).get(...values)
              return row ? { ...row } : null
            },
            async all() {
              return {
                results: db
                  .prepare(sql)
                  .all(...values)
                  .map((r) => ({ ...r })),
              }
            },
            async run() {
              return {
                success: true,
                meta: {
                  changes: Number(db.prepare(sql).run(...values).changes),
                },
              }
            },
          }
        },
      }
    },
  } as unknown as D1Database
  return { db, d1 }
}
