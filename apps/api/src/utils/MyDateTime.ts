import { DateTime } from "luxon";
import { BadRequestError } from "../errors";
import { PositiveDuration } from "../value-objects/PositiveDuration";

export class MyDateTime {

  private readonly _dateTime: DateTime;
  private static readonly ZONE = 'Asia/Kuala_Lumpur';

  constructor(dateTime: DateTime | MyDateTime) {

    this._dateTime = dateTime instanceof MyDateTime
      ? dateTime.value
      : dateTime;

    if (!this._dateTime.isValid)
      throw new BadRequestError("Invalid datetime");
    
  }

  get value() {
    return this._dateTime;
  }

  static now() {
    return new MyDateTime(DateTime.now().setZone(this.ZONE));
  }

  static fromDateAndTime(date: string, time: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new BadRequestError("Expected YYYY-MM-DD | date: " + date);

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) 
      throw new BadRequestError("Expected HH:mm | date: " + time);

    return new MyDateTime(
      DateTime.fromISO(`${date}T${time}`, { 
        zone: this.ZONE }));
  }

  toUtcIso() {
    return this._dateTime.toUTC().toISO();
  }

  startOfDay() {
    return new MyDateTime(this._dateTime.startOf("day"));
  }

  nextDay() {
    return new MyDateTime(this._dateTime.startOf("day").plus({ days: 1 }));
  }

  plus(duration: PositiveDuration) {
    return new MyDateTime(this._dateTime.plus(duration.value));
  }

}