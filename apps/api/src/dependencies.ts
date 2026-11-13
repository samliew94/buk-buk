import { UpdateBooking } from './booking/UpdateBooking'
import { QueryPayments } from './payment/QueryPayments'
import { QueryRoomCategories } from './room-category/QueryRoomCategories'
import { UpdateRoomCategory } from './room-category/UpdateRoomCategory'
import { CreateRoomCategory } from './room-category/CreateRoomCategory'
import { QueryBookings } from './booking/QueryBookings'
import { QueryBooking } from './booking/QueryBooking'
import { QueryDemoPaymentOrder } from './payment/QueryDemoPaymentOrder'
import { AuthService, type AuthenticationService } from './auth/auth.service'
import type { Principal } from './auth/auth.types'
import type { Env } from './types/env'
import { CreateBusiness } from './business/CreateBusiness'
import { QueryBusiness } from './business/QueryBusiness'
import { UpdateBusiness } from './business/UpdateBusiness'
import { CreateCustomer } from './customer/CreateCustomer'
import { UpdateCustomer } from './customer/UpdateCustomer'
import { QueryCustomer } from './customer/QueryCustomer'
import { CreateRoom } from './room/CreateRoom'
import { QueryAvailableRooms } from './room-category/QueryAvailableRooms'
import { QueryRoomCategory } from './room-category/QueryRoomCategory'
import { QueryRooms } from './room/QueryRooms'
import { UpdateRoom } from './room/UpdateRoom'
import { CreateRoomCategoryRentalFee } from './room-rental/CreateRoomCategoryRentalFee'
import { QueryRoomCategoryRentalFee } from './room-rental/QueryRoomCategoryRentalFee'
import { UpdateRoomCategoryRentalFee } from './room-rental/UpdateRoomCategoryRentalFee'
import { CreateBooking } from './booking/CreateBooking'
import { QueryReservations } from './reservation/QueryReservations'
import { ReserveRooms } from './reservation/ReserveRooms'
import { QueryUpfrontPaymentPolicy } from './payment/QueryUpfrontPaymentPolicy'
import { CreatePayment } from './payment/CreatePayment'
import { InitiatePaymentGateway } from './payment/InitiatePaymentGateway'
import { SelectPaymentGateway } from './payment/SelectPaymentGateway'
import { Demo } from './payment/Demo'
import { CreateDemoPaymentOrder } from './payment/CreateDemoPaymentOrder'
import { HandleDemoPaymentWebhook } from './payment/HandleDemoPaymentWebhook'
import { QueryPayment } from './payment/QueryPayment'
import { ConfirmPayment } from './payment/ConfirmPayment'
import { ConfirmBooking } from './booking/ConfirmBooking'
import { CancelPayment } from './payment/CancelPayment'
import { SubmitDemoPayment } from './payment/SubmitDemoPayment'
import { CancelBooking } from './booking/CancelBooking'

export interface Dependencies {
  queryPayments: Pick<QueryPayments, 'query'>
  queryPayment: Pick<QueryPayment, 'query'>
  queryRoomCategory: Pick<QueryRoomCategory, 'query'>
  queryRoomCategories: Pick<QueryRoomCategories, 'query'>
  updateRoomCategory: Pick<UpdateRoomCategory, 'exec'>
  createRoomCategory: Pick<CreateRoomCategory, 'exec'>
  queryBookings: Pick<QueryBookings, 'query'>
  updateBooking: Pick<UpdateBooking, 'exec'>
  queryBooking: Pick<QueryBooking, 'query'>
  queryDemoPaymentOrder: Pick<QueryDemoPaymentOrder, 'query'>
  submitDemoPayment: Pick<SubmitDemoPayment, 'exec'>
  handleDemoPaymentWebhook: Pick<HandleDemoPaymentWebhook, 'exec'>
  authService: AuthenticationService
  createBusiness: Pick<CreateBusiness, 'exec'>
  queryBusiness: Pick<QueryBusiness, 'query'>
  updateBusiness: Pick<UpdateBusiness, 'exec'>
  createCustomer: Pick<CreateCustomer, 'exec'>
  updateCustomer: Pick<UpdateCustomer, 'exec'>
  queryCustomer: Pick<QueryCustomer, 'query'>
  createRoom: Pick<CreateRoom, 'exec'>
  queryRooms: Pick<QueryRooms, 'query'>
  updateRoom: Pick<UpdateRoom, 'exec'>
  createRoomCategoryRentalFee: Pick<CreateRoomCategoryRentalFee, 'exec'>
  queryRoomCategoryRentalFee: Pick<QueryRoomCategoryRentalFee, 'query'>
  updateRoomCategoryRentalFee: Pick<UpdateRoomCategoryRentalFee, 'exec'>
  createBooking: Pick<CreateBooking, 'exec'>
  queryReservations: Pick<QueryReservations, 'query' | 'queryByDate'>
}
export type DependencyFactory = (env: Env) => Dependencies
export type AppEnv = {
  Bindings: Env
  Variables: { dependencies: Dependencies; principal: Principal }
}

// The composition root: controllers depend on interfaces, not concrete services.
export const createDependencies: DependencyFactory = (env) => {
  const handleDemoPaymentWebhook = new HandleDemoPaymentWebhook(
    new ConfirmPayment(env.DB, new QueryPayment(env.DB)), new ConfirmBooking(env.DB),
    new CancelPayment(env.DB, new QueryPayment(env.DB)), new CancelBooking(env.DB),
  )
  return {
    queryPayments: new QueryPayments(env.DB),
    queryPayment: new QueryPayment(env.DB),
    queryRoomCategory: new QueryRoomCategory(env.DB),
    queryRoomCategories: new QueryRoomCategories(env.DB),
    updateRoomCategory: new UpdateRoomCategory(env.DB),
    createRoomCategory: new CreateRoomCategory(env.DB),
    queryBookings: new QueryBookings(env.DB),
    updateBooking: new UpdateBooking(env.DB, new QueryBooking(env.DB)),
    queryBooking: new QueryBooking(env.DB),
    queryDemoPaymentOrder: new QueryDemoPaymentOrder(env.DB),
    handleDemoPaymentWebhook,
    submitDemoPayment: new SubmitDemoPayment(env.DB, handleDemoPaymentWebhook),
    authService: new AuthService(env.JWT_SECRET, env.ADMIN_PASSWORD),
    createBusiness: new CreateBusiness(env.DB),
    queryBusiness: new QueryBusiness(env.DB),
    updateBusiness: new UpdateBusiness(env.DB),
    createCustomer: new CreateCustomer(env.DB),
    updateCustomer: new UpdateCustomer(env.DB),
    queryCustomer: new QueryCustomer(env.DB),
    createRoom: new CreateRoom(env.DB),
    queryRooms: new QueryRooms(env.DB),
    updateRoom: new UpdateRoom(env.DB),
    createRoomCategoryRentalFee: new CreateRoomCategoryRentalFee(env.DB),
    queryRoomCategoryRentalFee: new QueryRoomCategoryRentalFee(env.DB),
    updateRoomCategoryRentalFee: new UpdateRoomCategoryRentalFee(env.DB),
    createBooking: new CreateBooking(
      env.DB,
      new ReserveRooms(env.DB),
      new QueryUpfrontPaymentPolicy(env.DB),
      new CreatePayment(env.DB),
      new InitiatePaymentGateway(new SelectPaymentGateway(
        env.DB, new Demo(new CreateDemoPaymentOrder(env.DB)),
      )),
      new QueryAvailableRooms(env.DB),
      new QueryRoomCategory(env.DB),
    ),
    queryReservations: new QueryReservations(env.DB),
  }
}
