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

import * as application from '@nativescript/core/application';
import { ApproovServiceCommon } from './approov-service.common';
import ApproovServiceNative = io.approov.service.nativescript.ApproovServiceNative;

export class ApproovService extends ApproovServiceCommon {

    static initialize(config: string): void {
        const result = ApproovServiceNative.initialize(application.android.context, config);
        if (result.errorType)
            console.log(`ApproovService: ${result.errorMessage}`);
    }

    static setProceedOnNetworkFail(): void {
        ApproovServiceNative.setProceedOnNetworkFail();
    }

    static setTokenHeader(header: string, prefix: string): void {
        ApproovServiceNative.setTokenHeader(header, prefix);
    }

    static setBindingHeader(header: string): void {
        ApproovServiceNative.setBindingHeader(header);
    }

    static addSubstitutionHeader(header: string, requiredPrefix: string): void {
        ApproovServiceNative.addSubstitutionHeader(header, requiredPrefix);
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
            const callbackHandler = new ApproovServiceNative.ResultCallback({
                result: (result: ApproovResult) => {
                    if (result.errorType) {
                        reject({
                            type: result.errorType,
                            message: result.errorMessage,
					        rejectionARC: result.rejectionARC,
					        rejectionReasons: result.rejectionReasons,
                        })
                    }
                    else
                        resolve();
                }
            });
            ApproovServiceNative.precheck(callbackHandler);
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
            const callbackHandler = new ApproovServiceNative.ResultCallback({
                result: (result: ApproovResult) => {
                    if (result.errorType) {
                        reject({
                            type: result.errorType,
                            message: result.errorMessage,
                        })
                    }
                    else
                        resolve(result.result);
                }
            });
            ApproovServiceNative.fetchToken(url, callbackHandler);
        });
    }

    static getMessageSignature(message: string): String {
        return ApproovServiceNative.getMessageSignature(message).result;
    }
    
    static async fetchSecureString(key: string, newDef: string): Promise<String> {
        return new Promise<String>((resolve, reject) => {
            const callbackHandler = new ApproovServiceNative.ResultCallback({
                result: (result: ApproovResult) => {
                    if (result.errorType) {
                        reject({
                            type: result.errorType,
                            message: result.errorMessage,
					        rejectionARC: result.rejectionARC,
					        rejectionReasons: result.rejectionReasons,
                        })
                    }
                    else
                        resolve(result.result);
                }
            });
            ApproovServiceNative.fetchSecureString(key, newDef, callbackHandler);
        });
    }

    static async fetchCustomJWT(payload: string): Promise<String> {
        return new Promise<String>((resolve, reject) => {
            const callbackHandler = new ApproovServiceNative.ResultCallback({
                result: (result: ApproovResult) => {
                    if (result.errorType) {
                        reject({
                            type: result.errorType,
                            message: result.errorMessage,
					        rejectionARC: result.rejectionARC,
					        rejectionReasons: result.rejectionReasons,
                        })
                    }
                    else
                        resolve(result.result);
                }
            });
            ApproovServiceNative.fetchCustomJWT(payload, callbackHandler);
        });
    }
}
