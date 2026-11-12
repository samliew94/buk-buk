export class MyDate {
  constructor(private readonly _date: string) {

  }

  static new(_date: string) {
    return new MyDate(_date);
  }
}