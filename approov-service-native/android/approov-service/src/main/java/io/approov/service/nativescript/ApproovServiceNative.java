/*
 * Copyright (c) 2018-2022 CriticalBlue Ltd.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
 * Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

package io.approov.service.nativescript;

import android.content.Context;
import android.util.Log;

import com.criticalblue.approovsdk.Approov;

import java.io.IOException;
import java.lang.reflect.Field;
import java.net.URLStreamHandler;
import java.util.Hashtable;
import java.util.Map;
import java.util.HashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import java.net.URL;

import javax.net.ssl.HttpsURLConnection;

// ApproovServiceNative provides a mediation layer to the Approov SDK itself
public class ApproovServiceNative {
  /**
   * Interface that must be implemented to receive results from certain methods in
   * the ApproovServiceNative interface to ensure that they are not blocking
   */
  public interface ResultCallback {

    /**
     * Callback function to provide the result of certain methods.
     *
     * @param result is the ApproovResult
     */
    void result(ApproovResult result);
  }

  // tag for logging
  private static final String TAG = "ApproovService";

  // header that will be added to Approov enabled requests
  private static final String APPROOV_TOKEN_HEADER = "Approov-Token";

  // any prefix to be added before the Approov token, such as "Bearer "
  private static final String APPROOV_TOKEN_PREFIX = "";

  // flag indicating whether the Approov SDK has been initialized - if not then no Approov functionality is enabled
  private static boolean isInitialized = false;

  // hostname verifier that checks against the current Approov pins
  private static ApproovPinningVerifier pinningHostnameVerifier = null;

  // true if the interceptor should proceed on network failures and not add an Approov token
  private static boolean proceedOnNetworkFail = false;

  // any initial configuration used in order to detect a difference for any subsequent initialization attempt
  private static String initialConfig = null;

  // header to be used to send Approov tokens
  private static String approovTokenHeader = APPROOV_TOKEN_HEADER;

  // any prefix String to be added before the transmitted Approov token
  private static String approovTokenPrefix = APPROOV_TOKEN_PREFIX;

  // any header to be used for binding in Approov tokens or null if not set
  private static String bindingHeader = null;

  // map of headers that should have their values substituted for secure strings, mapped to their
  // required prefixes
  private static Map<String, String> substitutionHeaders = new HashMap<>();

  // set of query parameters that may be substituted, specified by the key name, mapped to their regex patterns
  private static Map<String, Pattern> substitutionQueryParams = new HashMap<>();

  // set of URL regexs that should be excluded from any Approov protection, mapped to the compiled Pattern
  private static Map<String, Pattern> exclusionURLRegexs = new HashMap<>();

  /**
   * This hooks the Https protocol handling to allow Approov to be added to networking
   * requests without the need to modify the application code to use a different networking
   * stack. This is based on the implementation of networking in NativeScript. The top level
   * is implemented at:
   *  https://github.com/NativeScript/NativeScript/blob/master/packages/core/http/http-request/index.android.ts
   * this then calls an underlying request handler implemented in the "Http.MakeRequest" implementation at:
   *  https://github.com/NativeScript/NativeScript/blob/master/packages/ui-mobile-base/android/widgets/src/main/java/org/nativescript/widgets/Async.java
   * This calls "HttpRequestTask.doInBackground" on a different thread which ultimately creates a
   * URL and then calls "openConnection" on it. We rely on the fact that the openConnection call
   * looks up a map from the scheme to an underlying "URLStreamHandler" implementation. We
   * use reflection to overwrite the map entry with our own https scheme handler that can
   * delegate to the original handler, but is also able to add Approov to the requests.
   *
   * @return true if the hooking completed okay, false otherwise
   */
  private static boolean hookHttpsProtocolHandler() {
    // this looks up the handlers field in the Android URL implementation by reflection, see:
    //  https://cs.android.com/android/platform/superproject/+/master:libcore/ojluni/src/main/java/java/net/URL.java
    // it is declared (in the Android 12) as a:
    //  static Hashtable<String,URLStreamHandler> handlers = new Hashtable<>();
    // and basically holds the map of the different URLStreamHandler implementations for different
    // protocols
    Field handlersField;
    try {
      handlersField = URL.class.getDeclaredField("handlers");
      Log.d(TAG, "class URL handlers found");
    }
    catch (NoSuchFieldException e) {
      // in older versions of Android this map used to be called "streamHandlers" so try that instead
      try {
        handlersField = URL.class.getDeclaredField("streamHandlers");
        Log.d(TAG, "class URL streamHandlers found");
      }
      catch (NoSuchFieldException ee) {
        Log.e(TAG, "No handlers/streamHandlers found in class URL");
        return false;
      }
    }

    // we have to make the handlers field visible to us by reflection
    handlersField.setAccessible(true);

    // we read the handlers field map value (which is declared static on the class)
    Hashtable<String, URLStreamHandler> handlers = null;
    try {
      Object rawHandlers = handlersField.get(null);
      handlers = (Hashtable<String, URLStreamHandler>)rawHandlers;
    }
    catch(IllegalAccessException e) {
      Log.e(TAG, "Illegal access for URL class handlers/streamHandlers field: " + e.toString());
      return false;
    }
    catch(IllegalArgumentException e) {
      Log.e(TAG, "Illegal argument for URL class handlers/streamHandlers field: " + e.toString());
      return false;
    }

    // next we lookup the existing https protocol handler (we assume that this has been populated
    // by earlier network requests) - note that technically access to this map is dangerous
    // because it could be subject to a race on an update in another thread also using URL, but
    // we consider this risk to be minimal as it only occurs once during this initialization phase
    URLStreamHandler httpsHandler = handlers.get("https");
    if (httpsHandler == null) {
      Log.e(TAG, "class URL https protocol handler not found");
      return false;
    }

    // now we overwrite the map entry with our own handler that delegates to the original
    handlers.put("https", new ApproovURLStreamHandler(httpsHandler));
    Log.d(TAG, "class URL https protocol handler updated and delegating to " + httpsHandler.getClass());
    return true;
  }

  /**
   * Dont't allow external construction of the class as it is used as a static singleton only.
   */
  private ApproovServiceNative() {
  }

  /**
   * Initializes the Approov SDK and thus enables the Approov features. This will generate
   * an error if a second attempt is made at initialization with a different config.
   *
   * @param context the Application context
   * @param config is the initial configuration to be used, or empty string for no initialization
   * @return ApproovResult the result of the initialization
   */
  public static ApproovResult initialize(Context context, String config) {
    if (isInitialized) {
        // if the SDK is previously initialized then the config must be the same
        Log.d(TAG, "reinitialized");
        if (!config.equals(initialConfig))
          return new ApproovResult("attempt to reinitialize with a different config", false);
    }
    else {
      try {
        // initialize the Approov SDK - note that for some versions of the SDK this may block briefly on the
        // first launch after install and this may therefore block Javascript execution briefly but we don't do this
        // asynchronously because we want to ensure that the initialization is completed before any potentially
        // protected API requests are run
        if (config.length() != 0)
          Approov.initialize(context, config, "auto", null);
        Approov.setUserProperty("approov-nativescript");
        pinningHostnameVerifier = new ApproovPinningVerifier(HttpsURLConnection.getDefaultHostnameVerifier());
        isInitialized = true;
        Log.d(TAG, "initialized");

        // now we setup the hooking of the networking library
        if (!hookHttpsProtocolHandler())
          return new ApproovResult("hooking Https protocol handling failed", false);
      } catch (IllegalArgumentException e) {
        Log.e(TAG, "initialization failed IllegalArgument: " + e.getMessage());;
        return new ApproovResult("initialization failed IllegalArgument: "+ e.getMessage(), false);
      } catch (IllegalStateException e) {
        Log.e(TAG, "initialization failed IllegalState: " + e.getMessage());;
        return new ApproovResult("initialization failed IllegalState: "+ e.getMessage(), false);
      }
      initialConfig = config;
    }
    return new ApproovResult(null);
  }

  /**
   * Indicates that requests should proceed anyway if it is not possible to obtain an Approov token
   * due to a networking failure. If this is called then the backend API can receive calls without the
   * expected Approov token header being added, or without header/query parameter substitutions being
   * made. Note that this should be used with caution because it may allow a connection to be established
   * before any dynamic pins have been received via Approov, thus potentially opening the channel to a MitM.
   */
  public static synchronized void setProceedOnNetworkFail() {
    Log.d(TAG, "setProceedOnNetworkFail");
    proceedOnNetworkFail = true;
  }

  /**
   * Sets a development key indicating that the app is a development version and it should
   * pass attestation even if the app is not registered or it is running on an emulator. The
   * development key value can be rotated at any point in the account if a version of the app
   * containing the development key is accidentally released. This is primarily
   * used for situations where the app package must be modified or resigned in
   * some way as part of the testing process.
   *
   * @param devKey is the development key to be used
   * @return ApproovResult to indicate any errors
   */
  public static ApproovResult setDevKey(String devKey) {
    try {
      Approov.setDevKey(devKey);
      Log.d(TAG, "setDevKey");
    }
    catch (IllegalStateException e) {
      return new ApproovResult("IllegalState: " + e.getMessage(), false);
    }
    catch (IllegalArgumentException e) {
      return new ApproovResult("IllegalArgument: " + e.getMessage(), false);
    }
    return new ApproovResult(null);
  }

  /**
   * Sets the header that the Approov token is added on, as well as an optional
   * prefix String (such as "Bearer "). By default the token is provided on
   * "Approov-Token" with no prefix.
   *
   * @param header is the header to place the Approov token on
   * @param prefix is any prefix String for the Approov token header
   */
  public static synchronized void setTokenHeader(String header, String prefix) {
    Log.d(TAG, "setTokenHeader " + header + ", " + prefix);
    approovTokenHeader = header;
    approovTokenPrefix = prefix;
  }

  /**
   * Sets a binding header that may be present on requests being made. A header should be
   * chosen whose value is unchanging for most requests (such as an Authorization header).
   * If the header is present, then a hash of the header value is included in the issued Approov
   * tokens to bind them to the value. This may then be verified by the backend API integration.
   *
   * @param header is the header to use for Approov token binding
   */
  public static synchronized void setBindingHeader(String header) {
      Log.d(TAG, "setBindingHeader " + header);
      bindingHeader = header;
  }

  /**
   * Adds the name of a header which should be subject to secure strings substitution. This
   * means that if the header is present then the value will be used as a key to look up a
   * secure string value which will be substituted into the header value instead. This allows
   * easy migration to the use of secure strings. A required prefix may be specified to deal
   * with cases such as the use of "Bearer " prefixed before values in an authorization header.
   *
   * @param header is the header to be marked for substitution
   * @param requiredPrefix is any required prefix to the value being substituted or null if not required
   */
  public static synchronized void addSubstitutionHeader(String header, String requiredPrefix) {
    if (requiredPrefix == null) {
        Log.d(TAG, "addSubstitutionHeader " + header);
        substitutionHeaders.put(header, "");
    }
    else {
        Log.d(TAG, "addSubstitutionHeader " + header + ", " + requiredPrefix);
        substitutionHeaders.put(header, requiredPrefix);
    }
  }

  /**
   * Removes a header previously added using addSubstitutionHeader.
   *
   * @param header is the header to be removed for substitution
   */
  public static synchronized void removeSubstitutionHeader(String header) {
    Log.d(TAG, "removeSubstitutionHeader " + header);
    substitutionHeaders.remove(header);
  }

  /**
   * Gets all of the substitution headers that are currently setup in a new map.
   * 
   * @return Map<String, String> of the substitution headers mapped to their required prefix
   */
  private static synchronized Map<String, String> getSubstitutionHeaders() {
    return new HashMap<>(substitutionHeaders);
  }

  /**
   * Adds a key name for a query parameter that should be subject to secure strings substitution.
   * This means that if the query parameter is present in a URL then the value will be used as a
   * key to look up a secure string value which will be substituted as the query parameter value
   * instead. This allows easy migration to the use of secure strings.
   *
   * @param key is the query parameter key name to be added for substitution
   */
  public static synchronized void addSubstitutionQueryParam(String key) {
    try {
      Pattern pattern = Pattern.compile("[\\?&]"+key+"=([^&;]+)");
      substitutionQueryParams.put(key, pattern);
      Log.d(TAG, "addSubstitutionQueryParam " + key);
    }
    catch (PatternSyntaxException e) {
      Log.e(TAG, "addSubstitutionQueryParam " + key + " error: " + e.getMessage());
    }
  }

  /**
   * Removes a query parameter key name previously added using addSubstitutionQueryParam.
   *
   * @param key is the query parameter key name to be removed for substitution
   */
  public static synchronized void removeSubstitutionQueryParam(String key) {
    Log.d(TAG, "removeSubstitutionQueryParam " + key);
    substitutionQueryParams.remove(key);
  }

  /**
   * Gets all of the substitution query parameters that are currently setup in a new map.
   * 
   * @return Map<String, Pattern> of the substitution query parameters mapped to their regex patterns
   */
  private static synchronized Map<String, Pattern> getSubstitutionQueryParams() {
    return new HashMap<>(substitutionQueryParams);
  }

  /**
   * Adds an exclusion URL regular expression. If a URL for a request matches this regular expression
   * then it will not be subject to any Approov protection. Note that this facility must be used with
   * EXTREME CAUTION due to the impact of dynamic pinning. Pinning may be applied to all domains added
   * using Approov, and updates to the pins are received when an Approov fetch is performed. If you
   * exclude some URLs on domains that are protected with Approov, then these will be protected with
   * Approov pins but without a path to update the pins until a URL is used that is not excluded. Thus
   * you are responsible for ensuring that there is always a possibility of calling a non-excluded
   * URL, or you should make an explicit call to fetchToken if there are persistent pinning failures.
   * Conversely, use of those option may allow a connection to be established before any dynamic pins
   * have been received via Approov, thus potentially opening the channel to a MitM.
   *
   * @param urlRegex is the regular expression that will be compared against URLs to exclude them
   */
  public static synchronized void addExclusionURLRegex(String urlRegex) {
    try {
      Pattern pattern = Pattern.compile(urlRegex);
      exclusionURLRegexs.put(urlRegex, pattern);
      Log.d(TAG, "addExclusionURLRegex " + urlRegex);
    }
    catch (PatternSyntaxException e) {
      Log.e(TAG, "addExclusionURLRegex " + urlRegex + " error: " + e.getMessage());
    }
  }

  /**
   * Removes an exclusion URL regular expression previously added using addExclusionURLRegex.
   *
   * @param urlRegex is the regular expression that will be compared against URLs to exclude them
   */
  public static synchronized void removeExclusionURLRegex(String urlRegex) {
    Log.d(TAG, "removeExclusionURLRegex " + urlRegex);
    exclusionURLRegexs.remove(urlRegex);
  }

  /**
   * Gets all of the exclusion URL regexs that are currently setup in a new map.
   * 
   * @return Map<String, Pattern> of the exclusion URL regexs mapped to their regex patterns
   */
  private static synchronized Map<String, Pattern> getExclusionURLRegexs() {
    return new HashMap<>(exclusionURLRegexs);
  }

  /**
   * Helper for a prefetch that must be executed on an instance of ApproovServiceNative. This
   * tries to fetch a token for a placeholder URL.
   */
  private void prefetchHelper() {
    Approov.fetchApproovToken(new PrefetchHandler(), "approov.io");
  }

  /**
   * Performs a background fetch to lower the effective latency of a subsequent token fetch or
   * secure string fetch by starting the operation earlier so the subsequent fetch may be able to
   * use cached data.
   */
  public static void prefetch() {
    try {
      ApproovServiceNative instance = new ApproovServiceNative();
      instance.prefetchHelper();
    }
    catch (IllegalStateException e) {
      Log.d(TAG,("prefetch IllegalState: " + e.getMessage()));
    }
  }

  /**
   * Callback handler for prefetch that only logs the result.
   */
  final private class PrefetchHandler implements Approov.TokenFetchCallback {
    /**
     * Construct a new PrefetchHandler.
     */
    public PrefetchHandler() {
    }

    @Override
    public void approovCallback(Approov.TokenFetchResult result) {
      if (result.getStatus() == Approov.TokenFetchStatus.UNKNOWN_URL)
        Log.d(TAG, "prefetch: SUCCESS");
      else
        Log.d(TAG, "prefetch: " + result.getStatus().toString());
    }
  }

  /**
   * Helper for a precheck that must be executed on an instance of ApproovServiceNative. This
   * tries to fetch a non-existent secure string in order to check for a rejection.
   *
   * @param callback callback is an instance of ResultCallback to provide the callback
   */
  private void precheckHelper(ResultCallback callback) {
    Approov.fetchSecureString(new PrecheckHandler(callback), "precheck-dummy-key", null);
  }

  /**
   * Performs a precheck to determine if the app will pass attestation. This requires secure
   * strings to be enabled for the account, although no strings need to be set up. This will
   * likely require network access so may take some time to complete. A callback interface
   * instance is provided. It may provide an erro if the precheck fails or if there is some other
   * problem. The error type will be "rejection if the app has failed Approov checks or "network"
   * for networking issues where a user initiated retry of the operation should be allowed.
   * A "rejection" may provide additional information about the cause of the rejection.
   * 
   * @@param callback is an instance of ResultCallback to provide the callback
   */
  public static void precheck(ResultCallback callback) {
    try {
      ApproovServiceNative instance = new ApproovServiceNative();
      instance.precheckHelper(callback);
    } catch (IllegalStateException e) {
      callback.result(new ApproovResult("IllegalState: " + e.getMessage(), false));
    } catch (IllegalArgumentException e) {
      callback.result(new ApproovResult("IllegalArgument: " + e.getMessage(), false));
    }
  }

  /**
   * Callback handler for prechecking that performs a callback when complete.
   */
  final private class PrecheckHandler implements Approov.TokenFetchCallback {
    // result callback to be called when a result is available
    private ResultCallback callback;

    /**
     * Construct a new PrecheckHandler.
     *
     * @param callback is the callback for providing results
     */
    public PrecheckHandler(ResultCallback callback) {
      this.callback = callback;
    }

    @Override
    public void approovCallback(Approov.TokenFetchResult result) {
      if (result.getStatus() == Approov.TokenFetchStatus.UNKNOWN_KEY)
        Log.d(TAG, "precheck: SUCCESS");
      else
        Log.d(TAG, "precheck: " + result.getStatus().toString());
      if (result.getStatus() == Approov.TokenFetchStatus.REJECTED)
        // if the request is rejected then we provide a special exception with additional information
        callback.result(new ApproovResult("precheck: " + result.getStatus().toString() + ": " +
                result.getARC() + " " + result.getRejectionReasons(),
                result.getARC(), result.getRejectionReasons()));
      else if ((result.getStatus() == Approov.TokenFetchStatus.NO_NETWORK) ||
               (result.getStatus() == Approov.TokenFetchStatus.POOR_NETWORK) ||
               (result.getStatus() == Approov.TokenFetchStatus.MITM_DETECTED))
        // we are unable to get the secure string due to network conditions so the request can
        // be retried by the user later
        callback.result(new ApproovResult("precheck: " + result.getStatus().toString(), true));
      else if ((result.getStatus() != Approov.TokenFetchStatus.SUCCESS) &&
               (result.getStatus() != Approov.TokenFetchStatus.UNKNOWN_KEY))
        // we are unable to get the secure string due to a more permanent error
        callback.result(new ApproovResult("precheck: " + result.getStatus().toString(), false));
      else
        callback.result(new ApproovResult(null));
    }
  }

  /**
   * Gets the device ID used by Approov to identify the particular device that the SDK is running on. Note
   * that different Approov apps on the same device will return a different ID. Moreover, the ID may be
   * changed by an uninstall and reinstall of the app.
   * 
   * @return ApproovResult with the device ID or any error
   */
  public static ApproovResult getDeviceID() {
    try {
      String deviceID = Approov.getDeviceID();
      Log.d(TAG, "getDeviceID: " + deviceID);
      return new ApproovResult(deviceID);
    }
    catch (IllegalStateException e) {
      return new ApproovResult("IllegalState: " + e.getMessage(), false);
    }
  }

  /**
   * Directly sets the data hash to be included in subsequently fetched Approov tokens. If the hash is
   * different from any previously set value then this will cause the next token fetch operation to
   * fetch a new token with the correct payload data hash. The hash appears in the
   * 'pay' claim of the Approov token as a base64 encoded string of the SHA256 hash of the
   * data. Note that the data is hashed locally and never sent to the Approov cloud service.
   * 
   * @param data is the data to be hashed and set in the token
   * @return ApproovResult to indicate any errors
   */
  public static ApproovResult setDataHashInToken(String data) {
    try {
      Approov.setDataHashInToken(data);
      Log.d(TAG, "setDataHashInToken");
    }
    catch (IllegalStateException e) {
      return new ApproovResult("IllegalState: " + e.getMessage(), false);
    }
    catch (IllegalArgumentException e) {
      return new ApproovResult("IllegalArgument: " + e.getMessage(), false);
    }
    return new ApproovResult(null);
  }

  /**
   * Helper for fetchToken that must be executed on an instance of ApproovServiceNative.
   *
   * @param url is the URL giving the domain for the token fetch
   * @param callback callback is an instance of ResultCallback to provide the callback
   */
  private void fetchTokenHelper(String url, ResultCallback callback) {
    Approov.fetchApproovToken(new FetchTokenHandler(callback), url);
  }

  /**
   * Performs an Approov token fetch for the given URL. This should be used in situations where it
   * is not possible to use the networking interception to add the token. This will
   * likely require network access so may take some time to complete. It may return an error
   * if there is some problem. The error type "network" is for networking issues where a
   * user initiated retry of the operation should be allowed.
   * 
   * @param url is the URL giving the domain for the token fetch
   * @param callback callback is an instance of ResultCallback to provide the callback
   */
  public static void fetchToken(String url, ResultCallback callback) {
    try {
      ApproovServiceNative instance = new ApproovServiceNative();
      instance.fetchTokenHelper(url, callback);
    }
    catch (IllegalStateException e) {
      callback.result(new ApproovResult("IllegalState: " + e.getMessage(), false));
    }
    catch (IllegalArgumentException e) {
      callback.result(new ApproovResult("IllegalArgument: " + e.getMessage(), false));
    }
  }

  /**
   * Callback handler for fetchToken that performs a callback when complete.
   */
  final private class FetchTokenHandler implements Approov.TokenFetchCallback {
    // result callback to be called when a result is available
    private ResultCallback callback;

    /**
     * Construct a new FetchTokenHandler.
     *
     * @param callback is the callback for providing results
     */
    public FetchTokenHandler(ResultCallback callback) {
      this.callback = callback;
    }

    @Override
    public void approovCallback(Approov.TokenFetchResult result) {
      Log.d(TAG, "fetchToken: " + result.getStatus().toString());
      if ((result.getStatus() == Approov.TokenFetchStatus.NO_NETWORK) ||
          (result.getStatus() == Approov.TokenFetchStatus.POOR_NETWORK) ||
          (result.getStatus() == Approov.TokenFetchStatus.MITM_DETECTED))
        // we are unable to get the token due to network conditions
        callback.result(new ApproovResult("fetchToken: " + result.getStatus().toString(), true));
      else if (result.getStatus() != Approov.TokenFetchStatus.SUCCESS)
        // we are unable to get the token due to a more permanent error
        callback.result(new ApproovResult("fetchToken: " + result.getStatus().toString(), false));
      else
        // provide the Approov token result
        callback.result(new ApproovResult(result.getToken()));
    }
  }

  /**
   * Gets the signature for the given message. This uses an account specific message signing key that is
   * transmitted to the SDK after a successful fetch if the facility is enabled for the account. Note
   * that if the attestation failed then the signing key provided is actually random so that the
   * signature will be incorrect. An Approov token should always be included in the message
   * being signed and sent alongside this signature to prevent replay attacks.
   *
   * @param message is the message whose content is to be signed
   * @return ApproovResult with base64 encoded signature of the message, or an error otherwise
   */
  public static ApproovResult getMessageSignature(String message) {
    try {
      String signature = Approov.getMessageSignature(message);
      Log.d(TAG, "getMessageSignature");
      if (signature == null)
        return new ApproovResult("no signature available", false);
      else
        return new ApproovResult(signature);
    }
    catch (IllegalStateException e) {
        return new ApproovResult("IllegalState: " + e.getMessage(), false);
    }
    catch (IllegalArgumentException e) {
      return new ApproovResult("IllegalArgument: " + e.getMessage(), false);
    }
  }

  /**
   * Helper for fetchSecureString that must be executed on an instance of ApproovServiceNative.
   *
   * @param type is the type of operation being performed
   * @param key is the secure string key to be looked up
   * @param newDef is any new definition for the secure string, or null for lookup only
   * @param callback callback is an instance of ResultCallback to provide the callback
   */
  private void fetchSecureStringHelper(String type, String key, String newDef, ResultCallback callback) {
    Approov.fetchSecureString(new FetchSecureStringHandler(callback, type, key), key, newDef);
  }

  /**
   * Fetches a secure string with the given key. If newDef is not null then a
   * secure string for the particular app instance may be defined. In this case the
   * new value is returned as the secure string. Use of an empty string for newDef removes
   * the string entry. Note that this call may require network transaction and thus may block
   * for some time, so should not be called from the UI thread. If the attestation fails
   * for any reason then an ApproovResult error is provided. The error type will be "rejection"
   * if the app has failed Approov checks or "network" for networking issues where
   * a user initiated retry of the operation should be allowed. Note that the returned string
   * should NEVER be cached by your app, you should call this function when it is needed.
   *
   * @param key is the secure string key to be looked up
   * @param newDef is any new definition for the secure string, or null for lookup only
   * @param callback callback is an instance of ResultCallback to provide the callback
   */
  public static void fetchSecureString(String key, String newDef, ResultCallback callback) {
    // determine the type of operation as the values themselves cannot be logged
    String type = "lookup";
    if (newDef != null)
        type = "definition";

    // fetch any secure string keyed by the value, catching any exceptions the SDK might throw
    try {
        ApproovServiceNative instance = new ApproovServiceNative();
        instance.fetchSecureStringHelper(type, key, newDef, callback);
    }
    catch (IllegalStateException e) {
        callback.result(new ApproovResult("fetchSecureString IllegalState: " + e.getMessage(), false));
    }
    catch (IllegalArgumentException e) {
        callback.result(new ApproovResult("fetchSecureString IllegalArgument: " + e.getMessage(), false));
    }
  }

  /**
   * Callback handler for fetchSecureString that performs a callback when complete.
   */
  final private class FetchSecureStringHandler implements Approov.TokenFetchCallback {
    // result callback to be called when a result is available
    private ResultCallback callback;

    // type of the operation being performed
    private String type;

    // key on which the operation is being performed
    private String key;

    /**
     * Construct a new FetchSecureStringHandler.
     *
     * @param callback is the callback for providing results
     * @param type is the type of operation being performed
     * @param key is the key that the operation is being performed upon
     */
    public FetchSecureStringHandler(ResultCallback callback, String type, String key) {
      this.callback = callback;
      this.type = type;
      this.key = key;
    }

    @Override
    public void approovCallback(Approov.TokenFetchResult result) {
      Log.d(TAG, "fetchSecureString " + type + " for " + key + ": " + result.getStatus().toString());
      if (result.getStatus() == Approov.TokenFetchStatus.REJECTED)
        // if the request is rejected then we provide a special exception with additional information
        callback.result(new ApproovResult("fetchSecureString " + type + " for " + key + ": " +
                result.getStatus().toString() + ": " + result.getARC() +
                " " + result.getRejectionReasons(),
                result.getARC(), result.getRejectionReasons()));
      else if ((result.getStatus() == Approov.TokenFetchStatus.NO_NETWORK) ||
               (result.getStatus() == Approov.TokenFetchStatus.POOR_NETWORK) ||
               (result.getStatus() == Approov.TokenFetchStatus.MITM_DETECTED))
        // we are unable to get the secure string due to network conditions so the request can
        // be retried by the user later
        callback.result(new ApproovResult("fetchSecureString " + type + " for " + key + ":" +
                result.getStatus().toString(), true));
      else if ((result.getStatus() != Approov.TokenFetchStatus.SUCCESS) &&
               (result.getStatus() != Approov.TokenFetchStatus.UNKNOWN_KEY))
        // we are unable to get the secure string due to a more permanent error
        callback.result(new ApproovResult("fetchSecureString " + type + " for " + key + ":" +
                result.getStatus().toString(), false));
      else
        callback.result(new ApproovResult(result.getSecureString()));
    }
  }

  /**
   * Helper for fetchCustomJWT that must be executed on an instance of ApproovServiceNative.
   *
   * @param payload is the marshaled JSON object for the claims to be included
   * @param callback callback is an instance of ResultCallback to provide the callback
   */
  private void fetchCustomJWTHelper(String payload, ResultCallback callback) {
    Approov.fetchCustomJWT(new FetchCustomJWTHandler(callback), payload);
  }

  /**
   * Fetches a custom JWT with the given payload. Note that this call will require network
   * transaction and thus will block for some time, so should not be called from the UI thread.
   * If the attestation fails for any reason then this is reflected in the returned ApproovResult.
   * This error type will be "rejection" if the app has failed Approov checks or "network""
   * for networking issues where a user initiated retry of the operation should be allowed.
   *
   * @param payload is the marshaled JSON object for the claims to be included
   * @return callback callback is an instance of ResultCallback to provide the callback
   */
  public static void fetchCustomJWT(String payload, ResultCallback callback) {
    try {
        ApproovServiceNative instance = new ApproovServiceNative();
        instance.fetchCustomJWTHelper(payload, callback);
    }
    catch (IllegalStateException e) {
        callback.result(new ApproovResult("fetchCustomJWT IllegalState: " + e.getMessage(), false));
    }
    catch (IllegalArgumentException e) {
       callback.result(new ApproovResult("fetchCustomJWT IllegalArgument: " + e.getMessage(), false));
    }
  }

  /**
   * Callback handler for fetchCustomJWT that performs a callback when complete.
   */
  final private class FetchCustomJWTHandler implements Approov.TokenFetchCallback {
    // result callback to be called when a result is available
    private ResultCallback callback;

    /**
     * Construct a new FetchCustomJWTHandler.
     *
     * @param callback is the callback for providing results
     */
    public FetchCustomJWTHandler(ResultCallback callback) {
      this.callback = callback;
    }

    @Override
    public void approovCallback(Approov.TokenFetchResult result) {
      Log.d(TAG, "fetchCustomJWT: " + result.getStatus().toString());
      if (result.getStatus() == Approov.TokenFetchStatus.REJECTED)
        // if the request is rejected then we provide a special exception with additional information
        callback.result(new ApproovResult("fetchCustomJWT: "+ result.getStatus().toString() + ": " +
                result.getARC() +  " " + result.getRejectionReasons(),
                result.getARC(), result.getRejectionReasons()));
      else if ((result.getStatus() == Approov.TokenFetchStatus.NO_NETWORK) ||
               (result.getStatus() == Approov.TokenFetchStatus.POOR_NETWORK) ||
               (result.getStatus() == Approov.TokenFetchStatus.MITM_DETECTED))
        // we are unable to get the custom JWT due to network conditions so the request can
        // be retried by the user later
        callback.result(new ApproovResult("fetchCustomJWT: " + result.getStatus().toString(), true));
      else if (result.getStatus() != Approov.TokenFetchStatus.SUCCESS)
        // we are unable to get the custom JWT due to a more permanent error
        callback.result(new ApproovResult("fetchCustomJWT: " + result.getStatus().toString(), false));
      else
        callback.result(new ApproovResult(result.getToken()));
    }
  }

  /**
   * Performs any query parameter substitutions, which may require Approov fetches. This may convert
   * query parameters to map from their original values to a new value using a secure secret fetched
   * from the Approov cloud. Note that this does not specifically check that the domain being remapped
   * is added to Approov, so managed trust roots should always be enabled if using a non Approov added
   * domain to ensure the modified query parameter cannot be intercepted.
   * 
   * @param url is the URL being accessed that may contain query parameters
   * @return any updated URL, or the original if no change was made
   * @throws IOException if there is a problem, including due to an attestation failure
   */
  public static synchronized URL substituteQueryParams(URL url) throws IOException {
    // if Approov is not initialized then we don't make a change
    if (!isInitialized)
      return url;

    // we are only interested in URLs using the https protocol
    if (!url.getProtocol().equals("https"))
      return url;

    // check if the URL matches one of the exclusion regexs and just return if so
    String urlString = url.toString();
    Map<String, Pattern> exclusionURLs = getExclusionURLRegexs();
    for (Pattern pattern: exclusionURLs.values()) {
      Matcher matcher = pattern.matcher(urlString);
      if (matcher.find())
        return url;
    }

    // perform any query parameter processing
    URL newURL = null;
    Map<String, Pattern> subsQueryParams = getSubstitutionQueryParams();
    for (Map.Entry<String, Pattern> entry: subsQueryParams.entrySet()) {
        String queryKey = entry.getKey();
        Pattern pattern = entry.getValue();
        Matcher matcher = pattern.matcher(urlString);
        if (matcher.find()) {
            // we have found an occurrence of the query parameter to be replaced so we look up the existing
            // value as a key for a secure string
            String queryValue = matcher.group(1);
            Approov.TokenFetchResult approovResults = Approov.fetchSecureStringAndWait(queryValue, null);
            Log.d(TAG, "substituting query parameter: " + queryKey + ", " + approovResults.getStatus().toString());
            if (approovResults.getStatus() == Approov.TokenFetchStatus.SUCCESS) {
                // we have a successful lookup so update the URL with the secret value
                urlString = new StringBuilder(urlString).replace(matcher.start(1),
                        matcher.end(1), approovResults.getSecureString()).toString();
                newURL = new URL(urlString);
            }
            else if (approovResults.getStatus() == Approov.TokenFetchStatus.REJECTED)
                // if the request is rejected then we provide an exception with the information
                throw new IOException("Approov query parameter substitution for " + queryKey + ": " +
                        approovResults.getStatus().toString() + ": " + approovResults.getARC() +
                        " " + approovResults.getRejectionReasons());
            else if ((approovResults.getStatus() == Approov.TokenFetchStatus.NO_NETWORK) ||
                     (approovResults.getStatus() == Approov.TokenFetchStatus.POOR_NETWORK) ||
                     (approovResults.getStatus() == Approov.TokenFetchStatus.MITM_DETECTED)) {
                // we are unable to get the secure string due to network conditions so the request can
                // be retried by the user later - unless this is overridden
                if (!proceedOnNetworkFail)
                    throw new IOException("Approov query parameter substitution for " + queryKey + ": " +
                        approovResults.getStatus().toString());
            }
            else if (approovResults.getStatus() != Approov.TokenFetchStatus.UNKNOWN_KEY)
                // we have failed to get a secure string with a more serious permanent error
                throw new IOException("Approov query parameter substitution for " + queryKey + ": " +
                        approovResults.getStatus().toString());
        }
    }

    // return any new URL or just the old one if no changes were made
    if (newURL != null)
      return newURL;
    return url;
  }

  /**
   * Adds Approov to the given connection. The Approov token is added in a header and this
   * also overrides the HostnameVerifier with something that pins the connections. If a
   * binding header has been specified then its hash will be set if it is present. This function
   * may also substitute header values to hold secure string secrets. If it is not
   * currently possible to fetch an Approov token due to networking issues then
   * IOException is thrown and a user initiated retry of the operation should
   * be allowed. IOException is thrown if header substitution is being attempted and
   * the app fails attestation. Other IOExceptions represent a more permanent error condition.
   *
   * @param connection is the HttpsUrlConnection to which Approov is being added
   * @throws IOException if it is not possible to obtain an Approov token or secure strings
   */
  public static synchronized void addApproov(HttpsURLConnection connection) throws IOException {
    // just return if Approov has not been initialized
    String url = connection.getURL().toString();
    if (!isInitialized) {
      Log.d(TAG, "uninitialized forwarded: " + url);
      return;
    }

    // requests to localhost are just forwarded
    String host = connection.getURL().getHost();
    if (host.equals("localhost")) {
      Log.d(TAG, "localhost forwarded: " + url);
      return;
    }

    // ensure the connection is pinned - this is done even if the URL is excluded in case
    // the same domain is used for an Approov protected request and the same connection is live
    connection.setHostnameVerifier(pinningHostnameVerifier);

    // check if the URL matches one of the exclusion regexs and just return if so
    Map<String, Pattern> exclusionURLs = getExclusionURLRegexs();
    for (Pattern pattern: exclusionURLs.values()) {
      Matcher matcher = pattern.matcher(url);
      if (matcher.find()) {
        Log.d(TAG, "excluded url: " + url);
        return;
      }
    }

    // update the data hash based on any token binding header
    if (bindingHeader != null) {
      String headerValue = connection.getRequestProperty(bindingHeader);
      if (headerValue != null)
        Approov.setDataHashInToken(headerValue);
    }

    // request an Approov token for the domain
    Approov.TokenFetchResult approovResults = Approov.fetchApproovTokenAndWait(host);
    Log.d(TAG, "token for " + host + ": " + approovResults.getLoggableToken());

    // log if a configuration update is received and call fetchConfig to clear the update state
    if (approovResults.isConfigChanged()) {
      Approov.fetchConfig();
      Log.d(TAG, "dynamic configuration update received");
    }

    // check the status of Approov token fetch
    if (approovResults.getStatus() == Approov.TokenFetchStatus.SUCCESS)
      // we successfully obtained a token so add it to the header for the request
      connection.addRequestProperty(approovTokenHeader, approovTokenPrefix + approovResults.getToken());
    else if ((approovResults.getStatus() == Approov.TokenFetchStatus.NO_NETWORK) ||
             (approovResults.getStatus() == Approov.TokenFetchStatus.POOR_NETWORK) ||
             (approovResults.getStatus() == Approov.TokenFetchStatus.MITM_DETECTED)) {
      // we are unable to get an Approov token due to network conditions so the request can
      // be retried by the user later - unless this is overridden
      if (!proceedOnNetworkFail)
          throw new IOException("Approov token fetch for " + host + ": " + approovResults.getStatus().toString());
    }
    else if ((approovResults.getStatus() != Approov.TokenFetchStatus.NO_APPROOV_SERVICE) &&
             (approovResults.getStatus() != Approov.TokenFetchStatus.UNKNOWN_URL) &&
             (approovResults.getStatus() != Approov.TokenFetchStatus.UNPROTECTED_URL))
      // we have failed to get an Approov token with a more serious permanent error
      throw new IOException("Approov token fetch for " + host + ": " + approovResults.getStatus().toString());

    // we only continue additional processing if we had a valid status from Approov, to prevent additional delays
    // by trying to fetch from Approov again and this also protects against header substitutions in domains not
    // protected by Approov and therefore potential subject to a MitM
    if ((approovResults.getStatus() == Approov.TokenFetchStatus.SUCCESS) ||
        (approovResults.getStatus() == Approov.TokenFetchStatus.UNPROTECTED_URL)) {
      // we now deal with any header substitutions, which may require further fetches but these
      // should be using cached results
      Map<String, String> subsHeaders = getSubstitutionHeaders();
      for (Map.Entry<String, String> entry: subsHeaders.entrySet()) {
        String header = entry.getKey();
        String prefix = entry.getValue();
        String value = connection.getRequestProperty(header);
        if ((value != null) && value.startsWith(prefix) && (value.length() > prefix.length())) {
            approovResults = Approov.fetchSecureStringAndWait(value.substring(prefix.length()), null);
            Log.d(TAG, "substituting header " + header + ": " + approovResults.getStatus().toString());
            if (approovResults.getStatus() == Approov.TokenFetchStatus.SUCCESS) {
                // update the header with the actual secret
                connection.setRequestProperty(header, prefix + approovResults.getSecureString());
            }
            else if (approovResults.getStatus() == Approov.TokenFetchStatus.REJECTED)
                // if the request is rejected then we provide the information about the rejection
                throw new IOException("Approov header substitution for " + header + ": " +
                        approovResults.getStatus().toString() + ": " + approovResults.getARC() +
                        " " + approovResults.getRejectionReasons());
            else if ((approovResults.getStatus() == Approov.TokenFetchStatus.NO_NETWORK) ||
                     (approovResults.getStatus() == Approov.TokenFetchStatus.POOR_NETWORK) ||
                     (approovResults.getStatus() == Approov.TokenFetchStatus.MITM_DETECTED)) {
                // we are unable to get the secure string due to network conditions so the request can
                // be retried by the user later - unless this is overridden
                if (!proceedOnNetworkFail)
                    throw new IOException("Approov header substitution for " + header + ": " +
                        approovResults.getStatus().toString());
            }
            else if (approovResults.getStatus() != Approov.TokenFetchStatus.UNKNOWN_KEY)
                // we have failed to get a secure string with a more serious permanent error
                throw new IOException("Approov header substitution for " + header + ": " +
                        approovResults.getStatus().toString());
        }
      }
    }
  }
}
