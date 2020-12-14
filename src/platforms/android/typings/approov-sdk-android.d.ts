/// <reference path="android-declarations.d.ts"/>

declare namespace com {
  export namespace criticalblue {
    export namespace approovsdk {
      export class Approov {
        public static class: java.lang.Class<com.criticalblue.approovsdk.Approov>;

        public static fetchConfig(): string;

        public static initialize(param0: globalAndroid.content.Context, param1: string, param2: string, param3: string): void;

        public static fetchApproovToken(param0: com.criticalblue.approovsdk.Approov.TokenFetchCallback, param1: string): void;

        public static getIntegrityMeasurementProof(param0: native.Array<number>, param1: native.Array<number>): native.Array<number>;

        public static getMessageSignature(param0: string): string;

        public static fetchApproovTokenAndWait(param0: string): com.criticalblue.approovsdk.Approov.TokenFetchResult;

        public static getDeviceMeasurementProof(param0: native.Array<number>, param1: native.Array<number>): native.Array<number>;

        public static setDataHashInToken(param0: string): void;

        public static getMeasurementProof(param0: native.Array<number>, param1: string, param2: string): string;

        public static getSDKVersion(param0: globalAndroid.content.Context): string;

        public constructor();

        public static getDeviceID(): string;

        public static getPins(param0: string): java.util.Map<string, java.util.List<string>>;

        public static getSDKID(): number;

        public static setUserProperty(param0: string): void;

        public static setActivity(param0: globalAndroid.app.Activity): void;
      }

      export namespace Approov {
        export class TokenFetchCallback {
          public static class: java.lang.Class<com.criticalblue.approovsdk.Approov.TokenFetchCallback>;

          /**
           * Constructs a new instance of the com.criticalblue.approovsdk.Approov$TokenFetchCallback interface with the provided implementation. An empty constructor exists calling super() when extending the interface class.
           */
          public constructor(implementation: {
            approovCallback(param0: com.criticalblue.approovsdk.Approov.TokenFetchResult): void;
          });
          public constructor();

          public approovCallback(param0: com.criticalblue.approovsdk.Approov.TokenFetchResult): void;
        }

        export class TokenFetchResult {
          public static class: java.lang.Class<com.criticalblue.approovsdk.Approov.TokenFetchResult>;

          public isForceApplyPins(): boolean;

          public getMeasurementConfig(): native.Array<number>;

          public getToken(): string;

          public getARC(): string;

          public isConfigChanged(): boolean;

          public getLoggableToken(): string;

          public getStatus(): com.criticalblue.approovsdk.Approov.TokenFetchStatus;
        }

        export class TokenFetchStatus {
          public static class: java.lang.Class<com.criticalblue.approovsdk.Approov.TokenFetchStatus>;
          public static SUCCESS: com.criticalblue.approovsdk.Approov.TokenFetchStatus;
          public static NO_NETWORK: com.criticalblue.approovsdk.Approov.TokenFetchStatus;
          public static MITM_DETECTED: com.criticalblue.approovsdk.Approov.TokenFetchStatus;
          public static POOR_NETWORK: com.criticalblue.approovsdk.Approov.TokenFetchStatus;
          public static NO_APPROOV_SERVICE: com.criticalblue.approovsdk.Approov.TokenFetchStatus;
          public static BAD_URL: com.criticalblue.approovsdk.Approov.TokenFetchStatus;
          public static UNKNOWN_URL: com.criticalblue.approovsdk.Approov.TokenFetchStatus;
          public static UNPROTECTED_URL: com.criticalblue.approovsdk.Approov.TokenFetchStatus;
          public static NO_NETWORK_PERMISSION: com.criticalblue.approovsdk.Approov.TokenFetchStatus;
          public static MISSING_LIB_DEPENDENCY: com.criticalblue.approovsdk.Approov.TokenFetchStatus;
          public static INTERNAL_ERROR: com.criticalblue.approovsdk.Approov.TokenFetchStatus;

          public static valueOf(param0: string): com.criticalblue.approovsdk.Approov.TokenFetchStatus;

          public static values(): native.Array<com.criticalblue.approovsdk.Approov.TokenFetchStatus>;
        }
      }
    }
  }
}
