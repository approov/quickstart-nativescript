/*
 * Copyright (c) 2018-2021 CriticalBlue Ltd.
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

#import "ApproovServiceNative.h"
#import "ApproovNSInterceptor.h"
#import <Approov/Approov.h>
#import <CommonCrypto/CommonDigest.h>
#import <objc/runtime.h>


// Data access object for providing Approov results, which may be a successful string result or provide error information
@implementation ApproovResult

/**
 * Constructs a successful result.
 * 
 * @param result is the result, which may be nil
 */
- (nullable instancetype)initWithResult:(nullable NSString *)result {
    self = [super init];
    if (self)
    { 
        _result = result;
    }
    return self;
}

/**
 * Construct an error Approov result.
 * 
 * @param errorMessage the descriptive error message
 * @param isNetworkError is true for a network, as opposed to general, error type
 */
- (nullable instancetype)initWithErrorMessage:(nonnull NSString *)errorMessage isNetworkError:(BOOL)isNetworkError {
    self = [super init];
    if (self)
    { 
        _errorType = @"general";
        if (isNetworkError)
            _errorType = @"network";
        _errorMessage = errorMessage;
    }
    return self;
}

/**
 * Construct a rejection Approov error result.
 * 
 * @param errorMessage the descriptive rejection error message
 * @param rejectionARC the ARC or empty string if not enabled
 * @param rejectionReasons the rejection reasons or empty string if not enabled
 */
- (nullable instancetype)initWithRejectionErrorMessage:(nonnull NSString *)errorMessage rejectionARC:(nonnull NSString *)rejectionARC
    rejectionReasons:(nonnull NSString *)rejectionReasons {
    self = [super init];
    if (self)
    { 
        _errorType = @"rejection";
        _errorMessage = errorMessage;
        _rejectionARC = rejectionARC;
        _rejectionReasons = rejectionReasons;
    }
    return self;
}

@end


// ApproovServiceNative provides a mediation layer to the Approov SDK itself
@implementation ApproovServiceNative

// tag for logging
static NSString *TAG = @"ApproovService";

// lock object used during initialization
static id initializerLock = nil;

// keeps track of whether Approov is initialized to avoid initialization on every view appearance
static BOOL isInitialized = NO;

// original config string used during initialization
static NSString* initialConfigString = nil;

// true if the interceptor should proceed on network failures and not add an Approov token
static BOOL proceedOnNetworkFail = NO;

// header that will be added to Approov enabled requests
static NSString *approovTokenHeader = @"Approov-Token";

// any prefix to be added before the Approov token, such as "Bearer "
static NSString *approovTokenPrefix = @"";

// any header to be used for binding in Approov tokens or empty string if not set
static NSString *bindingHeader = @"";

// map of headers that should have their values substituted for secure strings, mapped to their required prefixes
static NSMutableDictionary<NSString *, NSString *> *substitutionHeaders = nil;

// set of query parameter keys whose values may be substituted for secure strings
static NSMutableSet<NSString *> *substitutionQueryParams = nil;

// set of URL regular expressions that should be excluded from Approov protection
static NSMutableSet<NSString *> *exclusionURLRegexs = nil;

/*
 * Initializes the ApproovService with the provided configuration string. The call is ignored if the
 * ApproovService has already been initialized with the same configuration string.
 *
 * @param config is the string to be used for initialization, or empty string for no initialization
 * @return ApproovResult showing if the initialization was successful, or provides an error otherwise
 */
+ (ApproovResult *)initialize:(NSString *)config {
    @synchronized(initializerLock) {
        if (isInitialized) {
            // if the SDK is previously initialized then check the config string is the same
            if (![initialConfigString isEqualToString:config]) {
                return [[ApproovResult alloc] initWithErrorMessage:@"attempt to reinitialize Approov SDK with a different config" isNetworkError:NO];
            }
        }
        else {
            // initialize the Approov SDK - note that for some versions of the SDK this may block briefly on the
            // first launch after install and this may therefore block Javascript execution briefly but we don't do this
            // asynchronously because we want to ensure that the initialization is completed before any potentially
            // protected API requests are run
            if ([config length] != 0) {
                NSError *initializationError = nil;
                [Approov initialize:config updateConfig:@"auto" comment:nil error:&initializationError];
                if (initializationError) {
                    NSLog(@"%@: initialization failed: %@", TAG, [initializationError localizedDescription]);
                    return [[ApproovResult alloc] initWithErrorMessage:[initializationError localizedDescription] isNetworkError:NO];
                }
            }

            // setup the state for the ApproovService
            [Approov setUserProperty:@"approov-nativescript"];
            substitutionHeaders = [[NSMutableDictionary alloc] init];
            substitutionQueryParams = [[NSMutableSet alloc] init];
            exclusionURLRegexs = [[NSMutableSet alloc] init];
            [ApproovServiceNative initializePublicKeyHeaders];
            [ApproovNSInterceptor hookNetworking];
            initialConfigString = config;
            isInitialized = YES;
            NSLog(@"%@: initialized on device %@", TAG, [Approov getDeviceID]);
        }
    }
    return [[ApproovResult alloc] initWithResult:nil];
}

/**
 * Verifies if the network hooking is complete. Special "https://setup" NativeScript network requests  should be made after
 * initializing the Approov SDK. This verifies that the earlier pinned session creations are properly associated with the NativeScript
 * networking requests.
 *
 * @return YES for valid verificaton, NO otherwise
 */
+ (BOOL)isNetworkHookingComplete {
    return [ApproovNSInterceptor arePinnedSessionsVerified];
}

/**
 * Indicates that requests should proceed anyway if it is not possible to obtain an Approov token
 * due to a networking failure. If this is called then the backend API can receive calls without the
 * expected Approov token header being added, or without header/query parameter substitutions being
 * made. Note that this should be used with caution because it may allow a connection to be established
 * before any dynamic pins have been received via Approov, thus potentially opening the channel to a MitM.
 */
+ (void)setProceedOnNetworkFail {
    // no need to synchronize on this
    proceedOnNetworkFail = YES;
    NSLog(@"%@: proceedOnNetworkFail", TAG);
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
+ (ApproovResult *)setDevKey:(NSString *)devKey {
    NSLog(@"%@: setDevKey", TAG);
    [Approov setDevKey:devKey];
    return [[ApproovResult alloc] initWithResult:nil];
}

/**
 * Sets the header that the Approov token is added on, as well as an optional
 * prefix String (such as "Bearer "). By default the token is provided on
 * "Approov-Token" with no prefix.
 *
 * @param header is the header to place the Approov token on
 * @param prefix is any prefix String for the Approov token header
 */
+ (void)setTokenHeader:(NSString *_Nonnull)header prefix:(NSString *_Nonnull)prefix {
    @synchronized(approovTokenHeader) {
        approovTokenHeader = header;
    }
    @synchronized(approovTokenPrefix) {
        approovTokenPrefix = prefix;
    }
    NSLog(@"%@: setTokenHeader %@, %@", TAG, header, prefix);
}

/**
 * Sets a binding header that may be present on requests being made. A header should be
 * chosen whose value is unchanging for most requests (such as an Authorization header).
 * If the header is present, then a hash of the header value is included in the issued Approov
 * tokens to bind them to the value. This may then be verified by the backend API integration.
 *
 * @param header is the header to use for Approov token binding
 */
+ (void)setBindingHeader:(NSString *)header {
    @synchronized(bindingHeader) {
        bindingHeader = header;
    }
    NSLog(@"%@: setBindingHeader %@", TAG, header);
}

/*
 * Adds the name of a header which should be subject to secure strings substitution. This
 * means that if the header is present then the value will be used as a key to look up a
 * secure string value which will be substituted into the header value instead. This allows
 * easy migration to the use of secure strings. A required prefix may be specified to deal
 * with cases such as the use of "Bearer " prefixed before values in an authorization header.
 *
 * @param header is the header to be marked for substitution
 * @param requiredPrefix is any required prefix to the value being substituted or nil if not required
 */
+ (void)addSubstitutionHeader:(NSString *)header requiredPrefix:(NSString *)requiredPrefix {
    if (requiredPrefix == nil) {
        @synchronized(substitutionHeaders) {
            if (substitutionHeaders != nil)
                [substitutionHeaders setValue:@"" forKey:header];
        }
        NSLog(@"%@: addSubstitutionHeader %@", TAG, header);
    } else {
        @synchronized(substitutionHeaders) {
            if (substitutionHeaders != nil)
                [substitutionHeaders setValue:requiredPrefix forKey:header];
        }
        NSLog(@"%@: addSubstitutionHeader %@, %@", TAG, header, requiredPrefix);
    }
}

/*
 * Removes a header previously added using addSubstitutionHeader.
 *
 * @param header is the header to be removed for substitution
 */
+ (void)removeSubstitutionHeader:(NSString *)header {
    @synchronized(substitutionHeaders) {
        if (substitutionHeaders != nil)
            [substitutionHeaders removeObjectForKey:header];
    }
    NSLog(@"%@: removeSubstitutionHeader %@", TAG, header);
}

/**
 * Adds a key name for a query parameter that should be subject to secure strings substitution.
 * This means that if the query parameter is present in a URL then the value will be used as a
 * key to look up a secure string value which will be substituted as the query parameter value
 * instead. This allows easy migration to the use of secure strings.
 *
 * @param key is the query parameter key name to be added for substitution
 */
+ (void)addSubstitutionQueryParam:(NSString *)key {
    @synchronized(substitutionQueryParams) {
        if (substitutionQueryParams != nil)
            [substitutionQueryParams addObject:key];
    }
    NSLog(@"%@: addSubstitutionQueryParam %@", TAG, key);
}

/**
 * Removes a query parameter key name previously added using addSubstitutionQueryParam.
 *
 * @param key is the query parameter key name to be removed for substitution
 */
+ (void)removeSubstitutionQueryParam:(NSString *)key {
    @synchronized(substitutionQueryParams) {
        if (substitutionQueryParams != nil)
            [substitutionQueryParams removeObject:key];
    }
    NSLog(@"%@: removeSubstitutionQueryParam %@", TAG, key);
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
+ (void)addExclusionURLRegex:(NSString *)urlRegex {
    @synchronized(exclusionURLRegexs) {
        if (exclusionURLRegexs != nil)
            [exclusionURLRegexs addObject:urlRegex];
    }
    NSLog(@"%@: addExclusionURLRegex %@", TAG, urlRegex);
}

/**
 * Removes an exclusion URL regular expression previously added using addExclusionURLRegex.
 *
 * @param urlRegex is the regular expression that will be compared against URLs to exclude them
 */
+ (void)removeExclusionURLRegex:(NSString *)urlRegex {
    @synchronized(exclusionURLRegexs) {
        if (exclusionURLRegexs != nil)
            [exclusionURLRegexs removeObject:urlRegex];
    }
    NSLog(@"%@: removeExclusionURLRegex %@", TAG, urlRegex);
}

/**
 * Prefetches to lower the effective latency of a subsequent token or secure string fetch by
 * starting the operation earlier so the subsequent fetch may be able to use cached data. The
 * prefetch is performed in the background and the result is only logged.
 */
+ (void)prefetch {
    [Approov fetchApproovToken:^(ApproovTokenFetchResult *result) {
        if (result.status == ApproovTokenFetchStatusUnknownURL)
            NSLog(@"%@: prefetch: success", TAG);
        else
            NSLog(@"%@: prefetch: %@", TAG, [Approov stringFromApproovTokenFetchStatus:result.status]);
    } :@"approov.io"];
}

/**
 * Performs a precheck to determine if the app will pass attestation. This requires secure
 * strings to be enabled for the account, although no strings need to be set up. A callback
 * function is provided that is supplied with rhe result when it is available.
 *
 * @param callback is an instance of ResultCallback to provide the callback
 */
+ (void)precheckWithCallback:(ResultCallback)callback  {
    [Approov fetchSecureString:^(ApproovTokenFetchResult *result) {
        if (result.status == ApproovTokenFetchStatusUnknownKey)
            NSLog(@"%@: precheck: success", TAG);
        else
            NSLog(@"%@: precheck: %@", TAG, [Approov stringFromApproovTokenFetchStatus:result.status]);
        if (result.status == ApproovTokenFetchStatusRejected) {
            NSString* details = [NSString stringWithFormat:@"Rejected %@ %@", result.ARC, result.rejectionReasons];
            callback([[ApproovResult alloc] initWithRejectionErrorMessage:details rejectionARC:result.ARC
                    rejectionReasons:result.rejectionReasons]);
        } else if ((result.status == ApproovTokenFetchStatusNoNetwork) ||
                   (result.status == ApproovTokenFetchStatusPoorNetwork) ||
                   (result.status == ApproovTokenFetchStatusMITMDetected)) {
            NSString* details = [NSString stringWithFormat:@"Network error: %@", [Approov stringFromApproovTokenFetchStatus:result.status]];
            callback([[ApproovResult alloc] initWithErrorMessage:details isNetworkError:YES]);
        } else if ((result.status != ApproovTokenFetchStatusSuccess) && (result.status != ApproovTokenFetchStatusUnknownKey)) {
            NSString* details = [NSString stringWithFormat:@"Error: %@", [Approov stringFromApproovTokenFetchStatus:result.status]];
            callback([[ApproovResult alloc] initWithErrorMessage:details isNetworkError:NO]);
        } else
            callback([[ApproovResult alloc] initWithResult:nil]);
    } :@"precheck-dummy-key" :nil];
}

/**
 * Gets the device ID used by Approov to identify the particular device that the SDK is running on. Note
 * that different Approov apps on the same device will return a different ID. Moreover, the ID may be
 * changed by an uninstall and reinstall of the app.
 * 
 * @return ApproovResult with the device ID or any error
 */
+ (ApproovResult *)getDeviceID {
    NSString *deviceID = [Approov getDeviceID];
    NSLog(@"%@: getDeviceID: %@", TAG, deviceID);
    return [[ApproovResult alloc] initWithResult:deviceID];
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
+ (ApproovResult *)setDataHashInToken:(NSString *)data {
    NSLog(@"%@: setDataHashInToken", TAG);
    [Approov setDataHashInToken:data];
    return [[ApproovResult alloc] initWithResult:nil];
}

/**
 * Performs an Approov token fetch for the given URL. This should be used in situations where it
 * is not possible to use the networking interception to add the token. A callback function is provided
 * that is supplied with the result when it is available.
 * 
 * @param url is the URL giving the domain for the token fetch
 * @param callback is an instance of ResultCallback to provide the callback
 */
+ (void)fetchToken:(NSString *)url callback:(ResultCallback)callback {
    [Approov fetchApproovToken:^(ApproovTokenFetchResult *result) {
        NSLog(@"%@: fetchToken %@: %@", TAG, url, [Approov stringFromApproovTokenFetchStatus:result.status]);
        if ((result.status == ApproovTokenFetchStatusNoNetwork) ||
            (result.status == ApproovTokenFetchStatusPoorNetwork) ||
            (result.status == ApproovTokenFetchStatusMITMDetected)) {
            NSString* details = [NSString stringWithFormat:@"Network error: %@", [Approov stringFromApproovTokenFetchStatus:result.status]];
            callback([[ApproovResult alloc] initWithErrorMessage:details isNetworkError:YES]);
        } else if (result.status != ApproovTokenFetchStatusSuccess) {
            NSString* details = [NSString stringWithFormat:@"Error: %@", [Approov stringFromApproovTokenFetchStatus:result.status]];
            callback([[ApproovResult alloc] initWithErrorMessage:details isNetworkError:NO]);
        } else
            callback([[ApproovResult alloc] initWithResult:result.token]);
    } :url];
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
+ (ApproovResult *)getMessageSignature:(NSString *)message {
    NSLog(@"%@: getMessageSignature", TAG);
    NSString *signature = [Approov getMessageSignature:message];
    if (signature == nil)
        return [[ApproovResult alloc] initWithErrorMessage:@"no signature available" isNetworkError:NO];
    else
        return [[ApproovResult alloc] initWithResult:signature];
}

/**
 * Fetches a secure string with the given key. If newDef is not nil then a
 * secure string for the particular app instance may be defined. In this case the
 * new value is returned as the secure string. Use of an empty string for newDef removes
 * the string entry. A callback function is provided that is supplied with the results
 * when they are available.
 *
 * @param key is the secure string key to be looked up
 * @param newDef is any new definition for the secure string, or nil for lookup only
 * @param callback is an instance of ResultCallback to provide the callback
 */
+ (void)fetchSecureString:(NSString*)key newDef:(NSString*)newDef callback:(ResultCallback)callback {
    // determine the type of operation as the values themselves cannot be logged
    NSString *type = @"lookup";
    if (newDef != nil)
        type = @"definition";
    
    // fetch any secure string keyed by the value
    [Approov fetchSecureString:^(ApproovTokenFetchResult *result) {
        NSLog(@"%@: fetchSecureString %@ for %@: %@", TAG, type, key, [Approov stringFromApproovTokenFetchStatus:result.status]);
        if (result.status == ApproovTokenFetchStatusRejected) {
            NSString* details = [NSString stringWithFormat:@"Rejected %@ %@", result.ARC, result.rejectionReasons];
            callback([[ApproovResult alloc] initWithRejectionErrorMessage:details rejectionARC:result.ARC
                    rejectionReasons:result.rejectionReasons]);
        } else if ((result.status == ApproovTokenFetchStatusNoNetwork) ||
                   (result.status == ApproovTokenFetchStatusPoorNetwork) ||
                   (result.status == ApproovTokenFetchStatusMITMDetected)) {
            NSString* details = [NSString stringWithFormat:@"Network error: %@", [Approov stringFromApproovTokenFetchStatus:result.status]];
            callback([[ApproovResult alloc] initWithErrorMessage:details isNetworkError:YES]);
        } else if ((result.status != ApproovTokenFetchStatusSuccess) && (result.status != ApproovTokenFetchStatusUnknownKey)) {
            NSString* details = [NSString stringWithFormat:@"Error: %@", [Approov stringFromApproovTokenFetchStatus:result.status]];
            callback([[ApproovResult alloc] initWithErrorMessage:details isNetworkError:NO]);
        } else
            callback([[ApproovResult alloc] initWithResult:result.secureString]);
    } :key :newDef];
}

/**
 * Fetches a custom JWT with the given payload. A callback function is provided to which
 * the result is supplied when it is available.
 *
 * @param payload is the marshaled JSON object for the claims to be included
 * @param callback is an instance of ResultCallback to provide the callback
 */
+ (void)fetchCustomJWT:(NSString*)payload callback:(ResultCallback)callback {
    [Approov fetchCustomJWT:^(ApproovTokenFetchResult *result) {
        NSLog(@"%@: fetchCustomJWT %@", TAG, [Approov stringFromApproovTokenFetchStatus:result.status]);
        if (result.status == ApproovTokenFetchStatusRejected) {
            NSString* details = [NSString stringWithFormat:@"Rejected %@ %@", result.ARC, result.rejectionReasons];
            callback([[ApproovResult alloc] initWithRejectionErrorMessage:details rejectionARC:result.ARC
                    rejectionReasons:result.rejectionReasons]);
        } else if ((result.status == ApproovTokenFetchStatusNoNetwork) ||
                   (result.status == ApproovTokenFetchStatusPoorNetwork) ||
                   (result.status == ApproovTokenFetchStatusMITMDetected)) {
            NSString* details = [NSString stringWithFormat:@"Network error: %@",
                    [Approov stringFromApproovTokenFetchStatus:result.status]];
            callback([[ApproovResult alloc] initWithErrorMessage:details isNetworkError:YES]);
        } else if (result.status != ApproovTokenFetchStatusSuccess) {
            NSString* details = [NSString stringWithFormat:@"Error: %@",
                    [Approov stringFromApproovTokenFetchStatus:result.status]];
            callback([[ApproovResult alloc] initWithErrorMessage:details isNetworkError:NO]);
        } else
            callback([[ApproovResult alloc] initWithResult:result.token]);
    }:payload];
}

/**
 * Creates an error if there was a problem adding the Approov protection to a request.
 *
 * @param message is the error merssage to tbe added
 * @return the created error message
 */
+ (NSError *)createErrorWithMessage:(NSString *)message {
    NSDictionary *userInfo = @{
         NSLocalizedDescriptionKey: NSLocalizedString(message, nil)
    };
    return [[NSError alloc] initWithDomain:@"approov" code:499 userInfo:userInfo];
}

/**
 * Adds Approov to the given request. This involves fetching an Approov token for the domain being accessed and
 * adding an Approov token to the outgoing header. This may also update the token if token binding is being used.
 * Header or query parameter values may also be substituted if this feature is enabled. The updated request is
 * returned.
 *
 * @param request is the request being updated
 * @param error is the error that is set if there is a problem
 * @return the updated request, or the original request if there was an error
 */
+ (NSURLRequest *)updateRequestWithApproov:(NSURLRequest *)request error:(NSError **)error {
    // get the URL host domain
    NSString *host = request.URL.host;
    if (host == nil) {
        NSLog(@"%@: request domain was missing or invalid", TAG);
        return request;
    }

    // we always allow requests to "localhost" without Approov protection as can be used for obtaining resources
    // during development
    NSString *url = request.URL.absoluteString;
    if ([host isEqualToString:@"localhost"]) {
        NSLog(@"%@: localhost forwarded: %@", TAG, url);
        return request;
    }

    // if the Approov SDK is not initialized then we just return immediately without making any changes
    if (!isInitialized) {
        NSLog(@"%@: uninitialized forwarded: %@", TAG, url);
        return request;
    }

    // obtain a copy of the exclusion URL regular expressions in a thread safe way
    NSSet<NSString *> *exclusionURLs;
    @synchronized(exclusionURLRegexs) {
        exclusionURLs = [[NSSet alloc] initWithSet:exclusionURLRegexs copyItems:NO];
    }

    // we just return with the existing URL if it matches any of the exclusion URL regular expressions provided
    for (NSString *exclusionURL in exclusionURLs) {
        NSError *error = nil;
        NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:exclusionURL options:0 error:&error];
        if (!error) {
            NSTextCheckingResult *match = [regex firstMatchInString:url options:0 range:NSMakeRange(0, [url length])];
            if (match) {
                NSLog(@"%@: excluded url: %@", TAG, url);
                return request;
            }
        }
    }

    // update the data hash based on any token binding header
    @synchronized(bindingHeader) {
        if (![bindingHeader isEqualToString:@""]) {
            NSString *headerValue = [request valueForHTTPHeaderField:bindingHeader];
            if (headerValue != nil) {
                [Approov setDataHashInToken:headerValue];
                NSLog(@"%@: setting data hash for binding header %@", TAG, bindingHeader);
            }
        }
    }

    // fetch the Approov token and log the result
    ApproovTokenFetchResult *result = [Approov fetchApproovTokenAndWait:url];
    NSLog(@"%@: token for %@: %@", TAG, host, [result loggableToken]);

    // log if a configuration update is received and call fetchConfig to clear the update state
    if (result.isConfigChanged) {
        [Approov fetchConfig];
        NSLog(@"%@: dynamic configuration update received", TAG);
    }

    // copy request into a form were it can be updated
    NSMutableURLRequest *updatedRequest = [request mutableCopy];

    // process the token fetch result
    ApproovTokenFetchStatus status = [result status];
    switch (status) {
        case ApproovTokenFetchStatusSuccess:
        {
            // add the Approov token to the required header
            NSString *tokenHeader;
            @synchronized(approovTokenHeader) {
                tokenHeader = approovTokenHeader;
            }
            NSString *tokenPrefix;
            @synchronized(approovTokenPrefix) {
                tokenPrefix = approovTokenPrefix;
            }
            NSString *value = [NSString stringWithFormat:@"%@%@", tokenPrefix, [result token]];
            [updatedRequest setValue:value forHTTPHeaderField:tokenHeader];
            break;
        }
        case ApproovTokenFetchStatusUnknownURL:
        case ApproovTokenFetchStatusUnprotectedURL:
        case ApproovTokenFetchStatusNoApproovService:
            // in these cases we continue without adding an Approov token
            break;
        case ApproovTokenFetchStatusNoNetwork:
        case ApproovTokenFetchStatusPoorNetwork:
        case ApproovTokenFetchStatusMITMDetected:
            // unless we are proceeding on network fail, we throw an exception if we are unable to get
            // an Approov token due to network conditions
            if (!proceedOnNetworkFail) {
                 *error = [ApproovServiceNative createErrorWithMessage:[Approov stringFromApproovTokenFetchStatus:status]];
                 return request;
            }
        default:
            // we have a more permanent error from the Approov SDK
            *error = [ApproovServiceNative createErrorWithMessage:[Approov stringFromApproovTokenFetchStatus:status]];
            return request;
    }

    // we just return early with anything other than a success or unprotected URL - this is to ensure we don't
    // make further Approov fetches if there has been a problem and also that we don't do header or query
    // parameter substitutions in domains not known to Approov (which therefore might not be pinned)
    if ((status != ApproovTokenFetchStatusSuccess) &&
        (status != ApproovTokenFetchStatusUnprotectedURL))
        return updatedRequest;

    // obtain a copy of the substitution headers in a thread safe way
    NSDictionary<NSString *, NSString *> *subsHeaders;
    @synchronized(substitutionHeaders) {
        subsHeaders = [[NSDictionary alloc] initWithDictionary:substitutionHeaders copyItems:NO];
    }

    // we now deal with any header substitutions, which may require further fetches but these
    // should be using cached results
    for (NSString *header in subsHeaders) {
        NSString *prefix = [substitutionHeaders objectForKey:header];
        NSString *value = [request valueForHTTPHeaderField:header];
        if ((value != nil) && (prefix != nil) && (value.length > prefix.length) &&
            (([prefix length] == 0) || [value hasPrefix:prefix])) {
            // the request contains the header we want to replace
            result = [Approov fetchSecureStringAndWait:[value substringFromIndex:prefix.length] :nil];
            status = [result status];
            NSLog(@"%@: substituting header %@: %@", TAG, header, [Approov stringFromApproovTokenFetchStatus:status]);
            if (status == ApproovTokenFetchStatusSuccess) {
                // update the header value with the actual secret
                [updatedRequest setValue:[NSString stringWithFormat:@"%@%@", prefix, result.secureString]
                    forHTTPHeaderField:header];
            } else if (status == ApproovTokenFetchStatusRejected) {
                // the attestation has been rejected so provide additional information in the message
                NSString *detail = [NSString stringWithFormat:@"Approov header substitution rejection %@ %@",
                    result.ARC, result.rejectionReasons];
                *error = [ApproovServiceNative createErrorWithMessage:detail];
                return request;
            } else if ((status == ApproovTokenFetchStatusNoNetwork) ||
                       (status == ApproovTokenFetchStatusPoorNetwork) ||
                       (status == ApproovTokenFetchStatusMITMDetected)) {
                // we are unable to get the secure string due to network conditions so the request can
                // be retried by the user later - unless overridden
                if (!proceedOnNetworkFail) {
                    NSString *detail = [NSString stringWithFormat:@"Header substitution network error: %@",
                        [Approov stringFromApproovTokenFetchStatus:status]];
                    *error = [ApproovServiceNative createErrorWithMessage:detail];
                    return request;
                }
            } else if (status != ApproovTokenFetchStatusUnknownKey) {
                // we have failed to get a secure string with a more serious permanent error
                NSString *detail = [NSString stringWithFormat:@"Header substitution error: %@",
                        [Approov stringFromApproovTokenFetchStatus:status]];
                *error = [ApproovServiceNative createErrorWithMessage:detail];
                return request;
            }
        }
    }

    // obtain a copy of the substitution query parameter in a thread safe way
    NSSet<NSString *> *subsQueryParams;
    @synchronized(substitutionQueryParams) {
        subsQueryParams = [[NSSet alloc] initWithSet:substitutionQueryParams copyItems:NO];
    }

    // we now deal with any query parameter substitutions, which may require further fetches but these
    // should be using cached results
    for (NSString *key in subsQueryParams) {
        NSString *pattern = [NSString stringWithFormat:@"[\\?&]%@=([^&;]+)", key];
        NSError *regexError = nil;
        NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:pattern options:0 error:&regexError];
        if (regexError) {
            NSString *detail = [NSString stringWithFormat: @"Approov query parameter substitution regex error: %@",
                [regexError localizedDescription]];
            *error = [ApproovServiceNative createErrorWithMessage:detail];
            return request;
        }
        NSTextCheckingResult *match = [regex firstMatchInString:url options:0 range:NSMakeRange(0, [url length])];
        if (match) {
            // the request contains the query parameter we want to replace
            NSString *matchText = [url substringWithRange:[match rangeAtIndex:1]];
            result = [Approov fetchSecureStringAndWait:matchText :nil];
            status = [result status];
            NSLog(@"%@: substituting query parameter %@: %@", TAG, key, [Approov stringFromApproovTokenFetchStatus:result.status]);
            if (status == ApproovTokenFetchStatusSuccess) {
                // update the URL with the actual secret
                url = [url stringByReplacingCharactersInRange:[match rangeAtIndex:1] withString:result.secureString];
                [updatedRequest setURL:[NSURL URLWithString:url]];
            } else if (status == ApproovTokenFetchStatusRejected) {
                // the attestation has been rejected so provide additional information in the message
                NSString *detail = [NSString stringWithFormat:@"Approov query parameter substitution rejection %@ %@",
                    result.ARC, result.rejectionReasons];
                *error = [ApproovServiceNative createErrorWithMessage:detail];
                return request;
            } else if ((status == ApproovTokenFetchStatusNoNetwork) ||
                       (status == ApproovTokenFetchStatusPoorNetwork) ||
                       (status == ApproovTokenFetchStatusMITMDetected)) {
                // we are unable to get the secure string due to network conditions so the request can
                // be retried by the user later - unless overridden
                if (!proceedOnNetworkFail) {
                    NSString *detail = [NSString stringWithFormat:@"Approov query parameter substitution network error: %@",
                        [Approov stringFromApproovTokenFetchStatus:status]];
                    *error = [ApproovServiceNative createErrorWithMessage:detail];
                    return request;
                }
            } else if (status != ApproovTokenFetchStatusUnknownKey) {
                // we have failed to get a secure string with a more serious permanent error
                NSString *detail = [NSString stringWithFormat:@"Approov query parameter substitution error: %@",
                    [Approov stringFromApproovTokenFetchStatus:status]];
                *error = [ApproovServiceNative createErrorWithMessage:detail];
                return request;
            }
        }
    }
    return updatedRequest;
}

// Subject Public Key Info (SPKI) headers for public keys' type and size. Only RSA-2048, RSA-4096, EC-256 and EC-384 are supported
NSDictionary<NSString *, NSDictionary<NSNumber *, NSData *> *> *sSPKIHeaders;

/**
 * Initialize the SPKI header constants.
 */
+ (void)initializePublicKeyHeaders {
    const unsigned char rsa2048SPKIHeader[] = {
        0x30, 0x82, 0x01, 0x22, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05,
        0x00, 0x03, 0x82, 0x01, 0x0f, 0x00
    };
    const unsigned char rsa3072SPKIHeader[] = {
        0x30, 0x82, 0x01, 0xA2, 0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01, 0x05,
        0x00, 0x03, 0x82, 0x01, 0x8F, 0x00
    };
    const unsigned char rsa4096SPKIHeader[] = {
        0x30, 0x82, 0x02, 0x22, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05,
        0x00, 0x03, 0x82, 0x02, 0x0f, 0x00
    };
    const unsigned char ecdsaSecp256r1SPKIHeader[] = {
        0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48,
        0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00
    };
    const unsigned char ecdsaSecp384r1SPKIHeader[] = {
        0x30, 0x76, 0x30, 0x10, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x05, 0x2b, 0x81, 0x04,
        0x00, 0x22, 0x03, 0x62, 0x00
    };
    sSPKIHeaders = @{
        (NSString *)kSecAttrKeyTypeRSA : @{
              @2048 : [NSData dataWithBytes:rsa2048SPKIHeader length:sizeof(rsa2048SPKIHeader)],
              @3072 : [NSData dataWithBytes:rsa3072SPKIHeader length:sizeof(rsa3072SPKIHeader)],
              @4096 : [NSData dataWithBytes:rsa4096SPKIHeader length:sizeof(rsa4096SPKIHeader)]
        },
        (NSString *)kSecAttrKeyTypeECSECPrimeRandom : @{
              @256 : [NSData dataWithBytes:ecdsaSecp256r1SPKIHeader length:sizeof(ecdsaSecp256r1SPKIHeader)],
              @384 : [NSData dataWithBytes:ecdsaSecp384r1SPKIHeader length:sizeof(ecdsaSecp384r1SPKIHeader)]
        }
    };
}

/**
 * Gets the subject public key info (SPKI) header depending on a public key's type and size.
 * 
 * @param publicKey is the public key being analyzed
 * @return NSData* of the coresponding SPKI header that will be used or nil if not supported
 */
+ (NSData *)publicKeyInfoHeaderForKey:(SecKeyRef)publicKey {
    CFDictionaryRef publicKeyAttributes = SecKeyCopyAttributes(publicKey);
    NSString *keyType = CFDictionaryGetValue(publicKeyAttributes, kSecAttrKeyType);
    NSNumber *keyLength = CFDictionaryGetValue(publicKeyAttributes, kSecAttrKeySizeInBits);
    NSData *aSPKIHeader = sSPKIHeaders[keyType][keyLength];
    CFRelease(publicKeyAttributes);
    return aSPKIHeader;
}

/**
 * Gets a certificate's Subject Public Key Info (SPKI).
 *
 * @param certificate is the certificate being analyzed
 * @return NSData* of the SPKI certificate information or nil if an error
 */
+ (NSData*)publicKeyInfoOfCertificate:(SecCertificateRef)certificate {
    // get the public key from the certificate and quite early if it is not obtained
    SecKeyRef publicKey = SecCertificateCopyKey(certificate);
    if (publicKey == nil) {
        NSLog(@"%@: public key of certificate not obtained", TAG);
        return nil;
    }
    
    // get the SPKI header depending on the public key's type and size
    NSData *spkiHeader = [self publicKeyInfoHeaderForKey:publicKey];
    if (spkiHeader == nil) {
        NSLog(@"%@: cannot create SPKI header", TAG);
        CFRelease(publicKey);
        return nil;
    }
    
    // combine the public key header and the public key data to form the public key info
    CFDataRef publicKeyData = SecKeyCopyExternalRepresentation(publicKey, nil);
    if (publicKeyData == nil)
        return nil;
    NSMutableData *publicKeyInfo = [NSMutableData dataWithData:spkiHeader];
    [publicKeyInfo appendData:(__bridge NSData * _Nonnull)(publicKeyData)];
    CFRelease(publicKeyData);
    return [NSData dataWithData:publicKeyInfo];
}

/**
 * Verifies pins usings the dynamic certificate public key pins provided by Approov.
 *
 * @param serverTrust provides the trust information extracted from the TLS negotiation
 * @param host is the domain name being connected to
 * @return the trust decision made
 */
+ (ApproovTrustDecision)verifyPins:(SecTrustRef)serverTrust forHost:(NSString *)host {
    // check we have a server trust
    if (!serverTrust) {
        NSLog(@"%@: verifyPins check missing server trust", TAG);
        return ApproovTrustDecisionBlock;
    }
    
    // check we have a host
    if (!host) {
        NSLog(@"%@: verifyPins check missing host", TAG);
        return ApproovTrustDecisionBlock;
    }
    
    // check the validity of the server trust
    if (!SecTrustEvaluateWithError(serverTrust, nil)) {
        NSLog(@"%@: verifyPins failed server trust validation", TAG);
        return ApproovTrustDecisionBlock;
    }

    // if the Approov SDK is not initialized then there are no pins so we proceed
    if (!isInitialized) {
        NSLog(@"%@: verifyPins for %@ called when Approov SDK not initialized", TAG, host);
        return ApproovTrustDecisionNotPinned;
    }

    // get the Approov pins for the host domain
    NSDictionary<NSString *, NSArray<NSString *> *> *approovPins = [Approov getPins:@"public-key-sha256"];
    NSArray<NSString *> *pinsForHost = approovPins[host];

    // if there are no pins for the domain (but the host is present) then use any managed trust roots instead
    if ((pinsForHost != nil) && [pinsForHost count] == 0)
        pinsForHost = approovPins[@"*"];

    // if we are not pinning then we consider this level of trust to be acceptable
    if ((pinsForHost == nil) || [pinsForHost count] == 0) {
        NSLog(@"%@: verifyPins host %@ not pinned", TAG, host);
        return ApproovTrustDecisionNotPinned;
    }
    
    // get the certificate chain count
    int certCountInChain = (int)SecTrustGetCertificateCount(serverTrust);
    int indexCurrentCert = 0;
    while (indexCurrentCert < certCountInChain) {
        // get the certificate - note that this function was deprecated in iOS 15 but the replacement function
        // SecTrustCopyCertificateChain is only available from iOS 15 too and returns an array of certificates so
        // has a significantly different interface, so the deprecated function must be used for now
        SecCertificateRef serverCert = SecTrustGetCertificateAtIndex(serverTrust, indexCurrentCert);
        if (serverCert == nil) {
            NSLog(@"%@: verifyPins check failed to read certificate from chain", TAG);
            return ApproovTrustDecisionBlock;
        }

        // get the subject public key info from the certificate - we just ignore the certificate if we
        // cannot obtain this in case it is a certificate type that is not supported but is not pinned
        // to anyway
        NSData* publicKeyInfo = [self publicKeyInfoOfCertificate:serverCert];
        if (publicKeyInfo == nil) {
            NSLog(@"%@: verifyPins check failed creation of public key information", TAG);
        } else {
            // compute the SHA-256 hash of the public key info and base64 encode the result
            CC_SHA256_CTX shaCtx;
            CC_SHA256_Init(&shaCtx);
            CC_SHA256_Update(&shaCtx,(void*)[publicKeyInfo bytes],(unsigned)publicKeyInfo.length);
            unsigned char publicKeyHash[CC_SHA256_DIGEST_LENGTH] = {'\0',};
            CC_SHA256_Final(publicKeyHash, &shaCtx);
            NSString *publicKeyHashB64 = [[NSData dataWithBytes:publicKeyHash length:CC_SHA256_DIGEST_LENGTH] base64EncodedStringWithOptions:0];
            
            // match pins on the receivers host
            for (NSString *pinHashB64 in pinsForHost) {
                if ([pinHashB64 isEqualToString:publicKeyHashB64]) {
                    NSLog(@"%@: verifyPins for %@ matched public key pin %@ from %lu pins", TAG, host, pinHashB64, [pinsForHost count]);
                    return ApproovTrustDecisionAllow;
                }
            }
        }

        // move to the next certificate in the chain
        indexCurrentCert++;
    }

    // the presented public key did not match any of the pins
    NSLog(@"%@: verifyPins for %@ failed to match one of %lu pins", TAG, host, [pinsForHost count]);
    return ApproovTrustDecisionBlock;
}

@end
