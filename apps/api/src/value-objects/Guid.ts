import { v7 as uuidv7 } from 'uuid';

export class Guid {

  constructor(readonly _value: string) {}

  static from(id: string) {
    return new Guid(id);
  }

  static new() {
    return this.from(uuidv7());
  }

  get value() {
    return this._value;
  }

}