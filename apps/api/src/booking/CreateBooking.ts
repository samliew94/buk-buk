import { BadRequestError } from '../errors';
import { CreatePayment } from "../payment/CreatePayment";
import { InitiatePaymentGateway } from "../payment/InitiatePaymentGateway";
import { PaymentStatus } from "../payment/payment-status.enum";
import { QueryUpfrontPaymentPolicy } from "../payment/QueryUpfrontPaymentPolicy";
import { UpfrontPayment } from "../payment/UpfrontPayment";
import { ReserveRooms } from "../reservation/ReserveRooms";
import { QueryAvailableRooms } from "../room-category/QueryAvailableRooms";
import { QueryRoomCategory } from "../room-category/QueryRoomCategory";
import { MyDateTime } from "../utils/MyDateTime";
import { Guid } from "../value-objects/Guid";
import { PositiveDuration } from "../value-objects/PositiveDuration";
import { BookingStatus } from "./booking-status.enum";

export class CreateBooking {
  constructor(
    private readonly _d1: D1Database,
    private readonly _reserveRooms: ReserveRooms,
    private readonly _queryUpfrontPaymentPolicy: QueryUpfrontPaymentPolicy,
    private readonly _createPayment: CreatePayment,
    private readonly _initiatePaymentGateway: InitiatePaymentGateway,
    private readonly _queryAvailableRooms: QueryAvailableRooms,
    private readonly _queryRoomCategory: QueryRoomCategory
  ) {}

  async exec(
    businessId: Guid,
    customerId: Guid,
    from: MyDateTime,
    duration: PositiveDuration, // in minutes
    roomCategoryId: Guid,
    quantity: number = 0,
    skipPayment: boolean = false) {

      const to = from.plus(duration);

      const roomCategory = await this._queryRoomCategory.query(roomCategoryId, businessId);

      if (roomCategory.acronym === 'RACING' && (!Number.isInteger(quantity) || quantity < 1 || quantity > 4))
        throw new BadRequestError('invalid quantity for room category | id: ' + roomCategoryId.value)

      const roomIds = await this._queryAvailableRooms.query(
        roomCategoryId,
        from,
        to,
        roomCategory.acronym === 'RACING' ? quantity : 1);

      const now = MyDateTime.now();

      const bookingId = Guid.new();

      // Admin-created bookings can skip payment regardless of business policy.
      const upfrontPayment = skipPayment ? null : await UpfrontPayment.fromRowResult(
        await this._queryUpfrontPaymentPolicy.query(businessId));

      // create booking record
      await this._d1.prepare(`
        INSERT INTO booking (id, customer_id, status, created_at, expire_at, business_id)
        VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(
            bookingId.value,
            customerId.value,
            upfrontPayment == null // if no need upfront payment, booking auto confirmed
              ? BookingStatus.CONFIRMED
              : BookingStatus.PENDING,
            now.toUtcIso(),
            now.plus(PositiveDuration.fromMinutes(10)).toUtcIso(),
            businessId.value)
          .run();

      // reserve room(s) - they will be blocked
      for (const roomId of roomIds) {
        await this._reserveRooms.exec(
          bookingId,
          roomId,
          roomCategoryId,
          from,
          to)}

      let paymentUrl: string | null = null;

      // if upfront payment is needed, create payment record and initiate payment gateway
      if (upfrontPayment) {

        const paymentId = Guid.new();

        await this._createPayment.exec(
          paymentId,
          bookingId,
          upfrontPayment.total,
          PaymentStatus.PENDING,
          MyDateTime.now());

        const result = await this._initiatePaymentGateway.exec(
          businessId,
          paymentId,
          upfrontPayment.total);

        paymentUrl = result.payment_url;
      }

      // initial booking flow ends here
      // if payment is needed, the customer will be redirected to complete payment at pg
      return { booking_id: bookingId, payment_url: paymentUrl };
  }
}
