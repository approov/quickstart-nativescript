export class Logger {
  static readonly prefix = 'ns-approov-sdk => ';

  static info(message: string, context: any = ''): void {
    console.log(`${this.prefix}${message}`, context);
  }
}
