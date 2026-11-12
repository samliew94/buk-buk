import { BadRequestError } from "../errors";

export class Phone {
  constructor(private readonly _value: string) {
    if (!this._value || this._value.trim().length === 0) {
      throw new BadRequestError("Phone cannot be empty");
    }
  }

  get value(): string {
    return this._value;
  }

  static from(value: string): Phone {
    return new Phone(value);
  }
}