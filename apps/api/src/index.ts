import { roomCategories } from './room-category/room-category.controller'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './auth/auth.controller'
import { business } from './business/business.controller'
import { customers } from './customer/customer.controller'
import { rooms } from './room/room.controller'
import { roomCategoryRentalFees } from './room-rental/room-category-rental-fee.controller'
import { bookings } from './booking/booking.controller'
import { reservations } from './reservation/reservation.controller'
import { demoPayments } from './payment/demo-payment.controller'
import { paymentWebhook } from './payment/payment-webhook.controller'
import { createDependencies, type AppEnv, type DependencyFactory } from './dependencies'
import { errorResponseMessage } from './errors'

export function createApp(dependencyFactory: DependencyFactory = createDependencies) {
  const app = new Hono<AppEnv>()
  app.use('*', cors())
  app.onError((error, c) => {
    const { message, status } = errorResponseMessage(error)
    if (status === 500) console.error(error)
    if (status === 401) c.header('WWW-Authenticate', 'Bearer')
    return c.json({ error: message }, status)
  })
  app.use('*', async (c, next) => {
    c.set('dependencies', dependencyFactory(c.env))
    await next()
  })
  app.get('/', (c) => c.json({ name: 'booking-api', status: 'ok' }))
  app.route('/v1/auth', auth)
  app.route('/v1/businesses', business)
  app.route('/v1/customers', customers)
  app.route('/v1/rooms', rooms)
  app.route('/v1/room-categories', roomCategories)
  app.route('/v1/room-category-rental-fees', roomCategoryRentalFees)
  app.route('/v1/bookings', bookings)
  app.route('/v1/reservations', reservations)
  app.route('/webhook/payment', paymentWebhook)
  app.route('/v1/demo-payment-orders', demoPayments)
  app.notFound((c) => c.json({ error: 'Not found' }, 404))
  return app
}

export default createApp()
