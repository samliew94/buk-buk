import { BadRequestError } from "../errors";

export class Name {
  constructor(private readonly _value: string) {
    if (!this._value || this._value.trim().length === 0) {
      throw new BadRequestError("Name cannot be empty");
    }
  }

  get value(): string {
    return this._value;
  }

  static from(value: string): Name {
    return new Name(value);
  }
}