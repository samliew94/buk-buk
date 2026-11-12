import { Duration } from "luxon";
import { BadRequestError } from "../errors";

export class PositiveDuration {
  constructor(readonly value: Duration) {
    if (!value.isValid || value.as("milliseconds") <= 0) {
      throw new BadRequestError("Duration must be positive");
    }
  }

  static fromMinutes(minutes: number): PositiveDuration {
    return new PositiveDuration(Duration.fromObject({ minutes }));
  }
}
