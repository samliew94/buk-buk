import { BadRequestError } from '../errors';

export class Acronym {
  constructor(private readonly _value: string) {
    if (!this._value || this._value.trim().length === 0) {
      throw new BadRequestError('acronym cannot be empty | value: ' + this._value);
    }
  }

  get value(): string {
    return this._value;
  }

  static from(value: string): Acronym {
    return new Acronym(value);
  }
}
