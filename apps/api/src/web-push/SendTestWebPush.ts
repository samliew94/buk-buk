import { PushSendError, type SendWebPushNotification } from './SendWebPushNotification'

export const testPayload = {
  title: 'BUK BUK',
  body: 'This is a test notification.',
  url: '/calendar',
}

export class SendTestWebPush {
  constructor(
    private readonly db: D1Database,
    private readonly sender: Pick<SendWebPushNotification, 'exec'>,
  ) {}

  async execForDevelopers() {
    const { results } = await this.db.prepare(`
      SELECT subscription.id
      FROM web_push_subscription AS subscription
      JOIN "user" AS owner ON owner.id = subscription.user_id
      WHERE owner.role = ? AND owner.is_banned = 0
      ORDER BY subscription.id
    `).bind('developer').all<{ id: string }>()
    const summary = { matched: results.length, accepted: 0, failed: 0 }
    for (const { id } of results) {
      try {
        await this.sender.exec({ subscription_id: id, ...testPayload })
        summary.accepted++
      } catch (error) {
        summary.failed++
        const failure = error instanceof PushSendError ? error : undefined
        console.warn('Web push test send failed', {
          subscription_id: id,
          status: failure?.status ?? 503,
          reason: failure?.message ?? 'web push unavailable | operation: test',
          provider_status: failure?.providerStatus,
        })
      }
    }
    return summary
  }
}
