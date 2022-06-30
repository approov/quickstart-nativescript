//
// MIT License
// 
// Copyright (c) 2016-present, Critical Blue Ltd.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
// ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH
// THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

export abstract class ApproovServiceCommon {
  static initialize(config: string): void {
    throw new Error('Method not overridden');
  }

  static setProceedOnNetworkFail(): void {
    throw new Error('Method not overridden');
  }

  static setTokenHeader(header: string, prefix: string): void {
    throw new Error('Method not overridden');
  }

  static setBindingHeader(header: string): void {
    throw new Error('Method not overridden');
  }

  static addSubstitutionHeader(header: string, requiredPrefix: string): void {
    throw new Error('Method not overridden');
  }

  static removeSubstitutionHeader(header: string): void {
    throw new Error('Method not overridden');
  }

  static addSubstitutionQueryParam(key: string): void {
    throw new Error('Method not overridden');
  }

  static removeSubstitutionQueryParam(key: string): void {
    throw new Error('Method not overridden');
  }

  static addExclusionURLRegex(urlRegex: string): void {
    throw new Error('Method not overridden');
  }

  static removeExclusionURLRegex(urlRegex: string): void {
    throw new Error('Method not overridden');
  }

  static prefetch(): void {
    throw new Error('Method not overridden');
  }

  static async precheck(): Promise<void> {
    throw new Error('Method not overridden');
  }

  static getDeviceID(): String {
    throw new Error('Method not overridden');
  }

  static setDataHashInToken(data: string): void {
    throw new Error('Method not overridden');
  }

  static async fetchToken(url: string): Promise<String> {
    throw new Error('Method not overridden');
  }

  static getMessageSignature(message: string): String {
    throw new Error('Method not overridden');
  }
 
  static async fetchSecureString(key: string, newDef: string): Promise<String> {
    throw new Error('Method not overridden');
  }

  static async fetchCustomJWT(payload: string): Promise<String> {
    throw new Error('Method not overridden');
  }
}
