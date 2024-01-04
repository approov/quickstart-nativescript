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
import * as HttpModule from '@nativescript/core/http';

export class ApproovService extends ApproovServiceCommon {

  static initialize(config: string): void {
      const result = ApproovServiceNative.initialize(config);
      if (result.errorType)
        console.log(`ApproovService: ${result.errorMessage}`);
      else {
        // we need to setup the networking hooking by executing some
        // networking requests so we use a IIFE to allow us to await on the
        // fetches to check if they were completed okay. Note that these
        // requests don't actually perform any networking as they are intercepted
        // by the hooks to avoid this and so should be fast to run. This IIFE is
        // executed asynchronously though so there is a chance that real network
        // requests proceed before this is complete. This isn't a problem for
        // NativeScript network requests but could cause issus if other native
        // level requests race with this so other activity like that should be
        // delayed for a short period after the Approov initialization.
        (async () => {
          await HttpModule.getString({
              method: 'GET',
              url: "https://setup/default",
            }).then(() => {}, () => {});
          await HttpModule.getString({
              method: 'GET',
              url: "https://setup/dontFollowRedirects",
              dontFollowRedirects: true
            }).then(() => {}, () => {});
          if (!ApproovServiceNative.isNetworkHookingComplete())
            console.log(`ApproovService: network hooking failed`);
        })();
      }
  }

  static setProceedOnNetworkFail(): void {
      ApproovServiceNative.setProceedOnNetworkFail();
  }

  static setDevKey(devKey: string): void {
    ApproovServiceNative.setDevKey(devKey);
  }

  static setTokenHeader(header: string, prefix: string): void {
      ApproovServiceNative.setTokenHeaderPrefix(header, prefix);
  }

  static setBindingHeader(header: string): void {
      ApproovServiceNative.setBindingHeader(header);
  }

  static addSubstitutionHeader(header: string, requiredPrefix: string): void {
      ApproovServiceNative.addSubstitutionHeaderRequiredPrefix(header, requiredPrefix);
  }

  static removeSubstitutionHeader(header: string): void {
      ApproovServiceNative.removeSubstitutionHeader(header);
  }

  static addSubstitutionQueryParam(key: string): void {
      ApproovServiceNative.addSubstitutionQueryParam(key);
  }

  static removeSubstitutionQueryParam(key: string): void {
      ApproovServiceNative.removeSubstitutionQueryParam(key);
  }

  static addExclusionURLRegex(urlRegex: string): void {
      ApproovServiceNative.addExclusionURLRegex(urlRegex);
  }

  static removeExclusionURLRegex(urlRegex: string): void {
      ApproovServiceNative.removeExclusionURLRegex(urlRegex);
  }

  static prefetch(): void {
      ApproovServiceNative.prefetch();
  }

  static async precheck(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
          ApproovServiceNative.precheckWithCallback((result: ApproovResult) => {
              if (result.errorType)
                  reject({
                      type: result.errorType,
                      message: result.errorMessage,
                      rejectionARC: result.rejectionARC,
                      rejectionReasons: result.rejectionReasons,
                  });
              else
                  resolve();
          });
      });
  }

  static getDeviceID(): String {
      return ApproovServiceNative.getDeviceID().result;
  }

  static setDataHashInToken(data: string): void {
      ApproovServiceNative.setDataHashInToken(data);
  }

  static async fetchToken(url: string): Promise<String> {
    return new Promise<String>((resolve, reject) => {
      ApproovServiceNative.fetchTokenCallback(url, (result: ApproovResult) => {
          if (result.errorType)
              reject({
                  type: result.errorType,
                  message: result.errorMessage,
              });
          else
              resolve(result.result);
        });
    });
  }

  static getMessageSignature(message: string): String {
      return ApproovServiceNative.getMessageSignature(message).result;
  }
  
  static async fetchSecureString(key: string, newDef: string): Promise<String> {
    return new Promise<String>((resolve, reject) => {
      ApproovServiceNative.fetchSecureStringNewDefCallback(key, newDef, (result: ApproovResult) => {
          if (result.errorType)
              reject({
                  type: result.errorType,
                  message: result.errorMessage,
                  rejectionARC: result.rejectionARC,
                  rejectionReasons: result.rejectionReasons,
              });
          else
              resolve(result.result);
        });
    });
  }

  static async fetchCustomJWT(payload: string): Promise<String> {
    return new Promise<String>((resolve, reject) => {
      ApproovServiceNative.fetchCustomJWTCallback(payload, (result: ApproovResult) => {
          if (result.errorType)
              reject({
                  type: result.errorType,
                  message: result.errorMessage,
                  rejectionARC: result.rejectionARC,
                  rejectionReasons: result.rejectionReasons,
              });
          else
              resolve(result.result);
        });
    });
  }
}
