
declare class Approov extends NSObject {

  static alloc(): Approov; // inherited from NSObject

  static fetchApproovToken(callbackHandler: (p1: ApproovTokenFetchResult) => void, url: string): void;

  static fetchApproovTokenAndWait(url: string): ApproovTokenFetchResult;

  static fetchConfig(): string;

  static getDeviceID(): string;

  static getDeviceMeasurementProof(nonce: NSData, measurementConfig: NSData): NSData;

  static getIntegrityMeasurementProof(nonce: NSData, measurementConfig: NSData): NSData;

  static getMessageSignature(message: string): string;

  static getPins(pinType: string): NSDictionary<string, NSArray<string>>;

  static initializeUpdateConfigCommentError(baseConfig: string, updateConfig: string, comment: string): boolean;

  static new(): Approov; // inherited from NSObject

  static setDataHashInToken(data: string): void;

  static setUserProperty(property: string): void;

  static stringFromApproovTokenFetchStatus(approovTokenFetchStatus: ApproovTokenFetchStatus): string;
}

declare class ApproovTokenFetchResult extends NSObject {

  static alloc(): ApproovTokenFetchResult; // inherited from NSObject

  static new(): ApproovTokenFetchResult; // inherited from NSObject

  readonly ARC: string;

  readonly isConfigChanged: boolean;

  readonly isForceApplyPins: boolean;

  readonly measurementConfig: NSData;

  readonly status: ApproovTokenFetchStatus;

  readonly token: string;

  loggableToken(): string;
}

declare const enum ApproovTokenFetchStatus {

  Success = 0,

  NoNetwork = 1,

  MITMDetected = 2,

  PoorNetwork = 3,

  NoApproovService = 4,

  BadURL = 5,

  UnknownURL = 6,

  UnprotectedURL = 7,

  NotInitialized = 8
}

declare var ApproovVersionNumber: number;

declare var ApproovVersionString: interop.Reference<number>;
