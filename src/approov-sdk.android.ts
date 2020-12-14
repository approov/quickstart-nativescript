import {
  ApproovConstants,
  dataObject, getHostnameFromUrl,
  HttpRequestOptions,
  HttpResponse,
  METHODS,
} from './approov-sdk.common';
import { isDefined } from '@nativescript/core/utils/types';
import * as application from '@nativescript/core/application';
import Approov = com.criticalblue.approovsdk.Approov;
import { Logger } from './logger';
import TokenFetchResult = com.criticalblue.approovsdk.Approov.TokenFetchResult;
import { NSApproovCommon } from './approov-sdk.common';
import * as applicationSettings from '@nativescript/core/application-settings';
import TokenFetchCallback = com.criticalblue.approovsdk.Approov.TokenFetchCallback;

let okHttpClient: okhttp3.OkHttpClient;

export class NSApproov extends NSApproovCommon {
  /**
   * initialize the Approov SDK
   */
  static async initialize(initialConfigFileName: string = ApproovConstants.INITIAL_CONFIG): Promise<void> {
    if (this.approovInitialized) {
      Logger.warning('Approov SDK already initialized.');
      return;
    }
    const initialConfig = await this.getInitialConfig(initialConfigFileName);

    let dynamicConfig: string = NSApproov.getDynamicConfig();

    Approov.initialize(application.android.context, initialConfig, dynamicConfig, null);
    Logger.info('Approov SDK initialized successfully.');

    // if we didn't have a dynamic configuration (after the first launch on the app) then
    // we fetch the latest and write it to local storage now
    if (!dynamicConfig) {
      await this.saveDynamicConfig();
    }

    await this.applyCertificatePinning();

    this.approovInitialized = true;
  }

  /**
   * Set the okHttpClient to null so that it is initialized with new pins afterwards
   */
  static applyCertificatePinning(): void {
    okHttpClient = null;
    Logger.info('TLS Pinning Reset');
  }

  /**
   * Fetches the Approov Token Synchronously
   */
  static getApproovTokenSync(url: string): TokenFetchResult {
    return Approov.fetchApproovTokenAndWait(url);
  }

  /**
   * Fetches the Approov Token Asynchronously.
   *
   * As soon as a token is fetched a native JavaScript promise is resolved
   */
  static getApproovToken(url: string): Promise<TokenFetchResult> {
    return new Promise<TokenFetchResult>(resolve => {
      const TokenFetchCallBack = new TokenFetchCallback({
        approovCallback: (result: TokenFetchResult) => {
          resolve(result);
        }
      });

      Approov.fetchApproovToken(TokenFetchCallBack, url);
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
      return Logger.warning('Unable to fetch the dynamic config');
    }

    applicationSettings.setString(ApproovConstants.DYNAMIC_CONFIG, dynamicConfig);
    Logger.info('Dynamic config updated');
  }

  /**
   * Helper method to return the okHttp3 client.
   *
   * If no client is found then a new client is initialized and then returned
   */
  private static getClient() {
    if (!okHttpClient) {
      this.initializeClient();
    }
    return okHttpClient;
  }

  private static initializeClient() {
    let client = new okhttp3.OkHttpClient.Builder();
    okHttpClient = client.certificatePinner(
      addApproovPinsToCertificateBuilder(new okhttp3.CertificatePinner.Builder())
        .build()
    ).build();
  }

  static request(opts: HttpRequestOptions): Promise<HttpResponse> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!opts.headers) {
          opts.headers = {};
        }
        opts.headers['Content-Type'] = <string> opts.headers['Content-Type'] || 'application/json';
        const host = getHostnameFromUrl(opts.url);

        let client = this.getClient();

        let requestBuilder: okhttp3.Request.Builder = new okhttp3.Request.Builder();
        requestBuilder.url(opts.url);

        // Is Approov Is initialized we then fetch the approov token
        if (NSApproov.isApproovInitialized()) {
          const approovHeader = NSApproov.getDomainHeader(host);

          if (approovHeader.binding) {
            if (opts.headers[approovHeader.binding]) {
              Approov.setDataHashInToken((opts.headers[approovHeader.binding]).toString());
            } else {
              reject({
                statusCode: 400,
                reason: `${Logger.prefix} missing token binding header: ${approovHeader.binding}`,
                content: `${Logger.prefix} missing token binding header: ${approovHeader.binding}`,
                reject: true,
                headers: opts.headers
              });
            }
          }

          const token = await fetchAndValidateApproovToken(opts.url);

          // Only append the header if we find a valid token
          if (token) {
            requestBuilder.addHeader(approovHeader.token, token);
          }
        }

        Object.keys(opts.headers).forEach(key => requestBuilder.addHeader(key, opts.headers[key] as any));

        if ((['GET', 'HEAD'].indexOf(opts.method) !== -1) || (opts.method === 'DELETE' && !isDefined(opts.body))) {
          requestBuilder[METHODS[opts.method]]();
        } else {
          // nothing but request.post(RequestBody.create(...))
          requestBuilder[METHODS[opts.method]](this.getRequestBody(opts));
        }

        // We have to allow networking on the main thread because larger responses will crash the app with an NetworkOnMainThreadException.
        // Note that it would probably be better to offload it to a Worker or (natively running) AsyncTask.
        // Also note that once set, this policy remains active until the app is killed.
        if (opts.allowLargeResponse) {
          android.os.StrictMode.setThreadPolicy(android.os.StrictMode.ThreadPolicy.LAX);
        }

        client.newCall(requestBuilder.build()).enqueue(new okhttp3.Callback({
          onResponse: (task, response) => {
            let content;
            let headers = this.getResponseHeaders(response.headers());
            let statusCode = response.code();
            if (response.isSuccessful()) {
              try {
                content = JSON.parse(response.body().string());
              } catch (e) {
              }
              resolve({ content, statusCode, headers });
            }
            reject({ statusCode, headers, reason: response.message(), reject: true });
          },
          onFailure: (task, error) => {
            reject({ statusCode: 400, reason: error.getMessage(), content: error.getMessage(), reject: true });
          },
        }));
      } catch (error) {
        reject({ statusCode: 400, reason: error.getMessage(), content: error.getMessage(), reject: true });
      }
    });
  }

  private static getRequestBody(requestOptions: HttpRequestOptions): okhttp3.RequestBody {
    if (this.isMultipartFormRequest(requestOptions.headers)) {
      const multipartBodyBuilder: okhttp3.MultipartBody.Builder = new okhttp3.MultipartBody.Builder()
        .setType(okhttp3.MultipartBody.FORM);
      (requestOptions.body.toString()).split('&')
        .forEach((keyValue: string) => {
          const [key, value] = keyValue.split('=');
          multipartBodyBuilder.addFormDataPart(key, decodeURIComponent(value));
        });
      return multipartBodyBuilder.build();
    }
    return okhttp3.RequestBody.create(
      okhttp3.MediaType.parse(<string> requestOptions.headers['Content-Type']),
      JSON.stringify(dataObject(requestOptions.body))
    );
  }

  private static getResponseHeaders(headers: okhttp3.Headers) {
    const mHeaders = {};
    let i: number, len: number = headers.size();
    for (i = 0; i < len; i++) {
      let key = headers.name(i);
      headers[key] = headers.value(i);
    }
    return mHeaders;
  }
}

/**
 * Helper Iterator callback that traverses the Native Java HashMap and LinkedHashMap
 */
function iterator<Key = string, Value = any>(iterator: java.util.Iterator<any>, callback: Function): void {
  const className = iterator.getClass().getName();
  while (iterator.hasNext()) {
    const item = iterator.next();
    if (className.includes('LinkedHashMap')) {
      callback(item.getValue(), item.getKey());
      continue;
    }

    if (className.includes('ArrayList')) {
      callback(item);
    }
  }
}


/**
 * Using this in place of OkHttpInterceptor because when we throw exception inside the
 * interceptor it crashes the application.
 *
 * @param url URL against which we will be fetching an APPROOV token
 */
async function fetchAndValidateApproovToken(url: string): Promise<string> {
  const approovToken = await NSApproov.getApproovToken(url);

  // update any dynamic configuration
  if (approovToken.isConfigChanged()) {
    NSApproov.saveDynamicConfig();
  }

  if (approovToken.isForceApplyPins()) {
    Logger.info('Applying Pinning again');
    NSApproov.applyCertificatePinning();
  }

  const tokenStatus = approovToken.getStatus();
  Logger.info('Token Status => ', approovToken.getStatus());
  Logger.info('Loggable Token => ', approovToken.getLoggableToken());
  if (tokenStatus === Approov.TokenFetchStatus.SUCCESS) {
    return Promise.resolve(approovToken.getToken());
  }

  // we have failed to get an Approov token in such a way that there is no point in proceeding
  // with the request - generally a retry is needed, unless the error is permanent
  if (
    (tokenStatus !== Approov.TokenFetchStatus.NO_APPROOV_SERVICE) &&
    (tokenStatus !== Approov.TokenFetchStatus.UNKNOWN_URL) &&
    (tokenStatus !== Approov.TokenFetchStatus.UNPROTECTED_URL)
  ) {
    return Promise.reject({
      status: 400,
      message: `${Logger.prefix} Token Fetch Error: ${approovToken.getStatus()}`,
      statusText: `${Logger.prefix} Token Fetch Error: ${approovToken.getStatus()}`,
    });
  }

  return Promise.resolve(null);
}

/**
 * Adds the certificate pins to the CertificatePinner fetched from approov.
 */
function addApproovPinsToCertificateBuilder(certificateBuilder: okhttp3.CertificatePinner.Builder): okhttp3.CertificatePinner.Builder {
  // Add the approov pins to builder only is approov is initialized
  if (!NSApproov.isApproovInitialized()) {
    return certificateBuilder;
  }

  const pins = Approov.getPins('public-key-sha256');
  // build the pinning configuration
  iterator(
    pins.entrySet().iterator(),
    (hashes: java.util.List<string>, domain: string) => {
      const pinHashes = [];
      iterator(hashes.iterator(), (hash: string) => pinHashes.push(`sha256/${hash}`));
      certificateBuilder.add(domain, pinHashes);
    }
  );
  return certificateBuilder;
}
