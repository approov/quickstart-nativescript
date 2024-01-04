/// <reference path="android-declarations.d.ts"/>

declare module io {
	export module approov {
		export module service {
			export module nativescript {
				export class ApproovResult {
					public static class: java.lang.Class<io.approov.service.nativescript.ApproovResult>;
					public result: string;
					public errorType: string;
					public errorMessage: string;
					public rejectionARC: string;
					public rejectionReasons: string;
				}
			}
		}
	}
}

declare module io {
	export module approov {
		export module service {
			export module nativescript {
				export class ApproovServiceNative {
					public static class: java.lang.Class<io.approov.service.nativescript.ApproovServiceNative>;
					public static setProceedOnNetworkFail(): void;
					public static prefetch(): void;
					public static setBindingHeader(param0: string): void;
					public static addSubstitutionHeader(param0: string, param1: string): void;
					public static removeSubstitutionHeader(param0: string): void;
					public static addSubstitutionQueryParam(param0: string): void;
					public static addExclusionURLRegex(param0: string): void;
					public static getDeviceID(): io.approov.service.nativescript.ApproovResult;
					public static initialize(param0: globalAndroid.content.Context, param1: string): io.approov.service.nativescript.ApproovResult;
					public static removeSubstitutionQueryParam(param0: string): void;
					public static getMessageSignature(param0: string): io.approov.service.nativescript.ApproovResult;
					public static precheck(param0: io.approov.service.nativescript.ApproovServiceNative.ResultCallback): void;
					public static setDataHashInToken(param0: string): io.approov.service.nativescript.ApproovResult;
					public static removeExclusionURLRegex(param0: string): void;
					public static setTokenHeader(param0: string, param1: string): void;
					public static fetchSecureString(param0: string, param1: string, param2: io.approov.service.nativescript.ApproovServiceNative.ResultCallback): void;
					public static setDevKey(param0: string): io.approov.service.nativescript.ApproovResult;
					public static fetchCustomJWT(param0: string, param1: io.approov.service.nativescript.ApproovServiceNative.ResultCallback): void;
					public static fetchToken(param0: string, param1: io.approov.service.nativescript.ApproovServiceNative.ResultCallback): void;
				}
				export module ApproovServiceNative {
					export class ResultCallback {
						public static class: java.lang.Class<io.approov.service.nativescript.ApproovServiceNative.ResultCallback>;
						public constructor(implementation: {
							result(param0: io.approov.service.nativescript.ApproovResult): void;
						});
						public constructor();
						public result(param0: io.approov.service.nativescript.ApproovResult): void;
					}
				}
			}
		}
	}
}
