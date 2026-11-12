import { BadRequestError } from "../errors";

export class Money {
  constructor(readonly value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestError("Money must be a finite, non-negative number");
    }
  }
}
