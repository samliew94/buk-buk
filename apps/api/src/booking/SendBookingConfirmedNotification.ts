import type { SendWebPushNotification } from '../web-push/SendWebPushNotification'

export class SendBookingConfirmedNotification {
  constructor(
    private readonly db: D1Database,
    private readonly sender: Pick<SendWebPushNotification, 'exec'>,
  ) {}

  async exec(bookingId: string): Promise<void> {
    try {
      const { results } = await this.db.prepare(`
        SELECT subscription.id
        FROM web_push_subscription AS subscription
        JOIN "user" AS owner ON owner.id = subscription.user_id
        WHERE owner.role IN ('developer', 'manager') AND owner.is_banned = 0
      `).bind().all<{ id: string }>()

      await Promise.all(results.map(async ({ id }) => {
        try {
          await this.sender.exec({
            subscription_id: id,
            title: 'Booking confirmed',
            body: 'A booking has been confirmed. Open to view the details.',
            url: '/bookings/' + encodeURIComponent(bookingId),
          })
        } catch {
          console.warn('Booking confirmation push failed', { booking_id: bookingId, subscription_id: id })
        }
      }))
    } catch {
      console.warn('Could not load booking confirmation push recipients', { booking_id: bookingId })
    }
  }
}
