
declare class ApproovResult extends NSObject {

	static alloc(): ApproovResult; // inherited from NSObject

	static new(): ApproovResult; // inherited from NSObject

	readonly errorMessage: string;

	readonly errorType: string;

	readonly rejectionARC: string;

	readonly rejectionReasons: string;

	readonly result: string;

	constructor(o: { errorMessage: string; isNetworkError: boolean; });

	constructor(o: { rejectionErrorMessage: string; rejectionARC: string; rejectionReasons: string; });

	constructor(o: { result: string; });

	initWithErrorMessageIsNetworkError(errorMessage: string, isNetworkError: boolean): this;

	initWithRejectionErrorMessageRejectionARCRejectionReasons(errorMessage: string, rejectionARC: string, rejectionReasons: string): this;

	initWithResult(result: string): this;
}

declare class ApproovServiceNative extends NSObject {

	static addExclusionURLRegex(urlRegex: string): void;

	static addSubstitutionHeaderRequiredPrefix(header: string, requiredPrefix: string): void;

	static addSubstitutionQueryParam(key: string): void;

	static alloc(): ApproovServiceNative; // inherited from NSObject

	static fetchCustomJWTCallback(payload: string, callback: (p1: ApproovResult) => void): void;

	static fetchSecureStringNewDefCallback(key: string, newDef: string, callback: (p1: ApproovResult) => void): void;

	static fetchTokenCallback(url: string, callback: (p1: ApproovResult) => void): void;

	static getDeviceID(): ApproovResult;

	static getMessageSignature(message: string): ApproovResult;

	static initialize(config: string): ApproovResult;

	static isNetworkHookingComplete(): boolean;

	static new(): ApproovServiceNative; // inherited from NSObject

	static precheckWithCallback(callback: (p1: ApproovResult) => void): void;

	static prefetch(): void;

	static removeExclusionURLRegex(urlRegex: string): void;

	static removeSubstitutionHeader(header: string): void;

	static removeSubstitutionQueryParam(key: string): void;

	static setBindingHeader(newHeader: string): void;

	static setDataHashInToken(data: string): ApproovResult;

	static setDevKey(devKey: string): ApproovResult;

	static setProceedOnNetworkFail(): void;

	static setTokenHeaderPrefix(header: string, prefix: string): void;

	static updateRequestWithApproovError(request: NSURLRequest): NSURLRequest;

	static verifyPinsForHost(serverTrust: any, host: string): ApproovTrustDecision;
}

declare var ApproovServiceNativeVersionNumber: number;

declare var ApproovServiceNativeVersionString: interop.Reference<number>;

declare const enum ApproovTrustDecision {

	Allow = 0,

	Block = 1,

	NotPinned = 2
}
