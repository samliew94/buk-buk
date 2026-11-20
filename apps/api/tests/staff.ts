import { createDependencies, type DependencyFactory } from '../src/dependencies'
import { UnauthorizedError } from '../src/errors'
import { createApp } from '../src/index'

export function createStaffTestApp(factory: DependencyFactory = createDependencies) {
  const app = createApp(env => ({
    ...factory(env),
    verifyAccessToken: {
      async exec(token) {
        if (token !== 'staff-fixture') throw new UnauthorizedError()
        return { id: 'staff-fixture', role: 'manager' }
      },
    },
  }))
  return {
    request(path: string, init?: RequestInit, env?: Parameters<typeof app.request>[2]) {
      const headers = new Headers(init?.headers)
      if (init?.method !== 'OPTIONS') headers.set('Authorization', 'Bearer staff-fixture')
      return app.request(path, { ...init, headers }, env)
    },
  }
}
