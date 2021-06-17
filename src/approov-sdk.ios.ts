import {
  HttpRequestOptions,
  HttpResponse,
  NSApproovCommon, ApproovConstants, getHostnameFromUrl
} from './approov-sdk.common';
import { Logger } from './logger';
import { isNullOrUndefined, isObject } from '@nativescript/core/utils/types';
import * as applicationSettings from '@nativescript/core/application-settings';
import { iOSNativeHelper } from '@nativescript/core/utils';
import MajorVersion = iOSNativeHelper.MajorVersion;

@NativeClass()
class CustomJSONSerializer extends AFJSONRequestSerializer {
  // Override method for string json body (To preserve dictionary keys ordering).
  requestBySerializingRequestWithParametersError(request: NSURLRequest, parameters: any): NSURLRequest {
    if (typeof parameters === 'string') {
      const copiedRequest: NSMutableURLRequest = request.mutableCopy();
      copiedRequest.setValueForHTTPHeaderField('application/json', 'Content-Type');
      copiedRequest.HTTPBody = NSString.stringWithString(parameters).dataUsingEncoding(NSUTF8StringEncoding);

      return copiedRequest;
    }
    return super.requestBySerializingRequestWithParametersError(request, parameters);
  }
}

// @dynamic
export class NSApproov extends NSApproovCommon {
  /**
   * Initializes the Approov SDK for IOS
   */
  static async initialize(initialConfigFileName: string = ApproovConstants.INITIAL_CONFIG): Promise<void> {
    if (this.approovInitialized) {
      Logger.warning('Approov SDK already initialized.');
      return;
    }
    const initialConfig = await this.getInitialConfig(initialConfigFileName);
    const dynamicConfig = NSApproov.getDynamicConfig();
    Approov.initializeUpdateConfigCommentError(initialConfig, dynamicConfig, 'Initialization Error.');

    Logger.info('Approov SDK initialized successfully.');

    if (!dynamicConfig) {
      await this.saveDynamicConfig();
    }

    this.approovInitialized = true;
  }

  /**
   * Fetches the ApproovToken Response Synchronously
   */
  static getApproovTokenSync(url: string): ApproovTokenFetchResult {
    return Approov.fetchApproovTokenAndWait(url);
  }


  /**
   * Fetches the Approov Token Asynchronously.
   *
   * As soon as a token is fetched a native JavaScript promise is resolved
   */
  static getApproovToken(url: string): Promise<ApproovTokenFetchResult> {
    return new Promise(resolve => {
      Approov.fetchApproovToken((approovFetchResult: ApproovTokenFetchResult) => {
        resolve(approovFetchResult);
      }, url);
    });
  }

  /**
   * Stores an application's dynamic configuration string in non-volatile storage.
   *
   * The default implementation stores the string in shared preferences for android
   * and NSUserDefaults in IOS.
   *
   * The config string to null is equivalent to removing the config.
   */
  static saveDynamicConfig(): void {
    const dynamicConfig = Approov.fetchConfig();
    Logger.info('Dynamic config fetched successfully.');
    if (!dynamicConfig) {
      return Logger.warning('Unable to fetch the dynamic config.');
    }

    applicationSettings.setString(ApproovConstants.DYNAMIC_CONFIG, dynamicConfig);
  }

  static AFSuccess(resolve, task: NSURLSessionDataTask, data?: NSDictionary<string, any> & NSData & NSArray<any>) {
    let content: any;
    if (data && data.class) {
      if (data.enumerateKeysAndObjectsUsingBlock || data.class().name === 'NSArray') {

        let serial = NSJSONSerialization.dataWithJSONObjectOptionsError(data, NSJSONWritingOptions.PrettyPrinted);
        content = NSString.alloc().initWithDataEncoding(serial, NSUTF8StringEncoding).toString();
      } else if (data.class().name === 'NSData') {
        content = NSString.alloc().initWithDataEncoding(data, NSASCIIStringEncoding).toString();
      } else {
        content = data;
      }
      try {
        content = JSON.parse(content);
      } catch (e) {
      }
    } else {
      content = data;
    }
    resolve({ task, content });
  }

  static AFFailure(resolve, reject, task: NSURLSessionDataTask, error: NSError) {
    const data: NSDictionary<string, any> & NSData & NSArray<any> = error.userInfo.valueForKey(AFNetworkingOperationFailingURLResponseDataErrorKey);
    const response = (task?.response as NSHTTPURLResponse);
    const parsedData = getData(data);

    const reason = error.localizedDescription;

    reject({
      task,
      content: parsedData,
      reason: reason === 'cancelled' ? 'Pinning Failed, cancelling request' : reason,
      statusCode: response?.statusCode || 0,
      headers: response?.allHeaderFields || {}
    });
  }

  static request(opts: HttpRequestOptions): Promise<HttpResponse> {
    return new Promise(async (resolve, reject) => {
      try {
        const manager = AFHTTPSessionManager.alloc().initWithBaseURL(NSURL.URLWithString(opts.url));

        manager.setSessionDidReceiveAuthenticationChallengeBlock(SessionDidReceiveAuthenticationChallengeBlock);

        opts.headers = opts.headers || {};

        if (opts.headers && (<any> opts.headers['Content-Type'])?.substring(0, 16) === 'application/json') {
          manager.requestSerializer = CustomJSONSerializer.alloc().init();
          manager.responseSerializer = AFJSONResponseSerializer.serializerWithReadingOptions(NSJSONReadingOptions.AllowFragments);
        } else {
          manager.requestSerializer = AFHTTPRequestSerializer.serializer();
          manager.responseSerializer = AFHTTPResponseSerializer.serializer();
        }
        manager.requestSerializer.allowsCellularAccess = true;

        const host = getHostnameFromUrl(opts.url);

        // Is Approov Is initialized we then fetch the approov token
        if (NSApproov.isApproovInitialized()) {
          const approovHeader = NSApproov.getDomainHeader(host);

          if (approovHeader.binding) {
            if (opts.headers[approovHeader.binding]) {
              Approov.setDataHashInToken((opts.headers[approovHeader.binding]).toString());
            } else {
              reject({
                statusCode: 400,
                content: `${Logger.prefix} missing token binding header: ${approovHeader.binding}`,
                reason: `${Logger.prefix} missing token binding header: ${approovHeader.binding}`,
              });
            }
          }

          const token = await fetchAndValidateApproovToken(opts.url);

          // Only append the header if we find a valid token
          if (token) {
            opts.headers[approovHeader.token] = token;
          }
        }

        let heads = opts.headers;
        if (heads) {
          Object.keys(heads).forEach(key => manager.requestSerializer.setValueForHTTPHeaderField(heads[key] as any, key));
        }

        let dict = null;
        if (opts.body) {
          let cont = opts.body;
          if (Array.isArray(cont)) {
            dict = NSMutableArray.new();
            cont.forEach(function (item, _) {
              dict.addObject(item);
            });
          } else if (isObject(cont)) {
            dict = NSMutableDictionary.new<string, any>();
            Object.keys(cont).forEach(key => dict.setValueForKey(cont[key] as any, key));
          } else {
            dict = cont;
          }
        }

        manager.requestSerializer.timeoutInterval = opts.timeout ? opts.timeout : 10;

        const headers = null;

        const success = (task: NSURLSessionDataTask, data?: any) => {
          this.AFSuccess(resolve, task, data);
        };

        const failure = (task, error) => {
          this.AFFailure(resolve, reject, task, error);
        };

        const progress = (_: NSProgress) => {
          // console.log("Finished?: " + progress.finished);
        };

        if (opts.method === 'GET') {
          manager.GETParametersHeadersProgressSuccessFailure(opts.url, dict, headers, progress, success, failure);
        } else if (opts.method === 'POST') {
          manager.POSTParametersHeadersProgressSuccessFailure(opts.url, dict, headers, progress, success, failure);
        } else if (opts.method === 'PUT') {
          manager.PUTParametersHeadersSuccessFailure(opts.url, dict, headers, success, failure);
        } else if (opts.method === 'DELETE') {
          manager.DELETEParametersHeadersSuccessFailure(opts.url, dict, headers, success, failure);
        } else if (opts.method === 'PATCH') {
          manager.PATCHParametersHeadersSuccessFailure(opts.url, dict, headers, success, failure);
        } else if (opts.method === 'HEAD') {
          manager.HEADParametersHeadersSuccessFailure(opts.url, dict, headers, success, failure);
        }
      } catch (error) {
        reject(error);
      }

    }).then((AFResponse: {
      task: NSURLSessionDataTask
      content: any
      reason?: string
    }) => {
      let sendi: HttpResponse = {
        content: AFResponse.content,
        headers: {},
      };

      let response = AFResponse.task.response as NSHTTPURLResponse;
      if (!isNullOrUndefined(response)) {
        sendi.statusCode = response.statusCode;
        let dict = response.allHeaderFields;
        dict.enumerateKeysAndObjectsUsingBlock((k, v) => sendi.headers[k] = v);
      }

      if (AFResponse.reason) {
        sendi.reason = AFResponse.reason;
      }

      return Promise.resolve(sendi);
    });
  }
}

// const rsa2048AsniHeader = new Uint8Array([
//   0x30, 0x82, 0x01, 0x22, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86,
//   0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00, 0x03, 0x82, 0x01, 0x0f, 0x00
// ]); as 'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8A' (BASE 64 string)

// const rsa4096AsniHeader = new Uint8Array([
//   0x30, 0x82, 0x02, 0x22, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86,
//   0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00, 0x03, 0x82, 0x02, 0x0f, 0x00
// ]); as 'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8A' (BASE 64 string)

// const ecdsaSecp256r1SPKIHeader = new Uint8Array([
//   0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48,
//   0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00
// ]); as (MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgA=) base 64 string

// const ecdsaSecp384r1SPKIHeader = new Uint8Array([
//   0x30, 0x76, 0x30, 0x10, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x05, 0x2b, 0x81, 0x04,
//   0x00, 0x22, 0x03, 0x62, 0x00
// ]); as (MHYwEAYHKoZIzj0CAQYFK4EEACIDYgA=) base 64 string

function getASNIHeaderBase64String(size: number): string {
  switch (size) {
    case 4096:
      return 'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8A';
    case 256:
      return 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgA=';
    case 384:
      return 'MHYwEAYHKoZIzj0CAQYFK4EEACIDYgA=';
    case 2048:
      return 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A';
    default:
      Logger.warning('Invalid ASNI header for SSL certificate! Cancelling Request.');
      return null;
  }
}

/**
 * Retrieves the public key data from the certificate
 */
function getPublicKeyData(certificate: any): any {
  if (MajorVersion >= 12) {
    // This wil only work for IOS 12 and above
    return SecCertificateCopyKey(certificate);
  }

  // Fallback for lower IOS versions
  let trust = new interop.Reference();
  const policy = SecPolicyCreateBasicX509();
  SecTrustCreateWithCertificates(certificate, policy, trust);

  // Get ref from the trust
  let result = new interop.Reference<SecTrustResultType>();
  SecTrustEvaluate(trust.value, result);

  if (result.value !== errSecSuccess) {
    return null;
  }

  return SecTrustCopyPublicKey(trust.value);

}

/**
 * Callback to handle the Pinning for Approov
 */
function SessionDidReceiveAuthenticationChallengeBlock(session: NSURLSession, challenge: NSURLAuthenticationChallenge, _: interop.Pointer | interop.Reference<NSURLCredential>) {
  // Default handling if not serverTrust or approov is not initialized
  if (challenge.protectionSpace.authenticationMethod !== NSURLAuthenticationMethodServerTrust || !NSApproov.isApproovInitialized()) {
    return NSURLSessionAuthChallengeDisposition.PerformDefaultHandling;
  }
  const serverTrustRef = challenge.protectionSpace.serverTrust;

  // Retrieves APPROOV pins for a particular domain.
  const approovPinsForDomain: NSArray<string> = Approov.getPins('public-key-sha256')
    .objectForKey(challenge.protectionSpace.host);

  // There is no pinning for this domain.
  // We just return from here and pass on.
  if (!approovPinsForDomain) {
    return NSURLSessionAuthChallengeDisposition.PerformDefaultHandling;
  }

  const count = SecTrustGetCertificateCount(serverTrustRef);

  for (let i = 0; i < count; i++) {
    const certRef = SecTrustGetCertificateAtIndex(serverTrustRef, i);
    // const certificateSubject = SecCertificateCopySubjectSummary(certRef);
    // console.log('Certificate Ref => ', certificateSubject);

    const publicKey = getPublicKeyData(certRef);
    // console.log('Public Key  => ', publicKey);
    const publicKeyData = SecKeyCopyExternalRepresentation(publicKey, null);

    // console.log('Public Key Data => ', publicKeyData);

    const publicKeyAttributes = SecKeyCopyAttributes(publicKey);

    // console.log('publicKeyAttributes =>   ', publicKeyAttributes);

    const keySize = publicKeyAttributes.objectForKey(kSecAttrKeySizeInBits);
    const hash: NSMutableData = NSMutableData.dataWithLength(32);

    const mutableBytes = NSMutableData.dataWithBytesLength(publicKeyData.bytes, publicKeyData.length);

    const base46EncodedPublicKey = getASNIHeaderBase64String(keySize) + mutableBytes.base64EncodedStringWithOptions(0);

    // Invalid Public key header, cancel the request.
    if (base46EncodedPublicKey === null) {
      return NSURLSessionAuthChallengeDisposition.CancelAuthenticationChallenge;
    }

    const publicKeyDataWithANSIHeader = NSData.alloc().initWithBase64Encoding(base46EncodedPublicKey);

    // console.log('Hash => ', base46EncodedPublicKey);

    CC_SHA256(publicKeyDataWithANSIHeader.bytes, publicKeyDataWithANSIHeader.length, <string> <unknown> hash.mutableBytes);

    const publicKeyPinFromServerTrust =  hash.base64EncodedStringWithOptions(0);

    // Check if any pin matches the pins that were retrieved from APPROOV SDK
    for (const approovPinsForDomainKey of approovPinsForDomain) {
      if (approovPinsForDomainKey === publicKeyPinFromServerTrust) {
        return NSURLSessionAuthChallengeDisposition.PerformDefaultHandling;
      }
    }
  }
  return NSURLSessionAuthChallengeDisposition.CancelAuthenticationChallenge;
}

/**
 * Using this in place of Interceptor because if we throw exception inside the
 * interceptor it crashes the application.
 *
 * @param url URL against which we will be fetching an APPROOV token
 */
async function fetchAndValidateApproovToken(url: string): Promise<string> {
  const approovToken = await NSApproov.getApproovToken(url);

  // update any dynamic configuration
  if (approovToken.isConfigChanged) {
    NSApproov.saveDynamicConfig();
  }

  const tokenStatus = approovToken.status;
  Logger.info('Token Status => ', tokenStatus);
  Logger.info('Loggable Token => ', approovToken.loggableToken());
  if (tokenStatus === ApproovTokenFetchStatus.Success) {
    return Promise.resolve(approovToken.token);
  }

  // we have failed to get an Approov token in such a way that there is no point in proceeding
  // with the request - generally a retry is needed, unless the error is permanent
  if (
    (tokenStatus !== ApproovTokenFetchStatus.NoApproovService) &&
    (tokenStatus !== ApproovTokenFetchStatus.UnknownURL) &&
    (tokenStatus !== ApproovTokenFetchStatus.UnprotectedURL)
  ) {
    return Promise.reject({
      status: 400,
      message: `${Logger.prefix} Token Fetch Error: ${tokenStatus}`,
      statusText: `${Logger.prefix} Token Fetch Error: ${tokenStatus}`,
    });
  }

  return Promise.resolve(null);
}


function getData(data): any {
  let content: any;
  if (data && data.class) {
    if (data.enumerateKeysAndObjectsUsingBlock || (<any> data) instanceof NSArray) {
      let serial = NSJSONSerialization.dataWithJSONObjectOptionsError(data, NSJSONWritingOptions.PrettyPrinted);
      content = NSString.alloc().initWithDataEncoding(serial, NSUTF8StringEncoding).toString();
    } else if ((<any> data) instanceof NSData) {
      content = NSString.alloc().initWithDataEncoding(data, NSASCIIStringEncoding).toString();
    } else {
      content = data;
    }

    try {
      content = JSON.parse(content);
    } catch (ignore) {
    }
  } else {
    content = data;
  }
  return content;
}
