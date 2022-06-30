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

import { ApproovServiceCommon } from './approov-service.common';

export declare class ApproovService extends ApproovServiceCommon {
  static initialize(config: string): void;
  static setProceedOnNetworkFail(): void;
  static setTokenHeader(header: string, prefix: string): void;
  static setBindingHeader(header: string): void;
  static addSubstitutionHeader(header: string, requiredPrefix: string): void;
  static removeSubstitutionHeader(header: string): void;
  static addSubstitutionQueryParam(key: string): void;
  static removeSubstitutionQueryParam(key: string): void;
  static addExclusionURLRegex(urlRegex: string): void;
  static removeExclusionURLRegex(urlRegex: string): void;
  static prefetch(): void;
  static precheck(): Promise<void>;
  static getDeviceID(): String;
  static setDataHashInToken(data: string): void;
  static fetchToken(url: string): Promise<String>;
  static getMessageSignature(message: string): String;
  static fetchSecureString(key: string, newDef: string): Promise<String>;
  static fetchCustomJWT(payload: string): Promise<String>;
}
