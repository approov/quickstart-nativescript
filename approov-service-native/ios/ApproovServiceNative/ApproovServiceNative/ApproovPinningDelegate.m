/*
 * MIT License
 *
 * Copyright (c) 2016-present, CriticalBlue Ltd.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
 * NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
 * OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

#import "ApproovPinningDelegate.h"

@interface PinningURLSessionDelegate ()

// the original delegate to which non-authentication calls are passed
@property id<NSURLSessionDataDelegate> originalDelegate;

@end

@implementation PinningURLSessionDelegate

// tag for logging
static NSString *TAG = @"ApproovService";

/** Creates a pinning URL session delegate.
 *
 * @param delegate is the original delgate
 */
+ (instancetype)createWithDelegate:(id<NSURLSessionDataDelegate>)delegate {
    return [[self alloc] initWithDelegate:delegate];
}

/**
 * Initializes a pinning URL session delegate.
 *
 * @param delegate is the original delgate
 */
- (instancetype)initWithDelegate:(id<NSURLSessionDataDelegate>)delegate {
    self = [super init];
    if (self) {
        _originalDelegate = delegate;
    }
    return self;
}

/**
 * Handles session authentication challenges. This is handled by Approov pinning and not passed to the original delegate.
 *
 * @param session is the session containing the task whose request requires authentication
 * @param challenge is an object that contains the request for authentication
 * @param completionHandler is a handler that must be called providing the outcome of the decision
 */
- (void)URLSession:(NSURLSession *)session
        didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge
        completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition disposition, NSURLCredential *credential))completionHandler {
    NSLog(@"%@: session received authentication challenge", TAG);
    if ([challenge.protectionSpace.authenticationMethod isEqualToString:NSURLAuthenticationMethodServerTrust]) {
        ApproovTrustDecision trustDecision = [ApproovServiceNative verifyPins:challenge.protectionSpace.serverTrust forHost:challenge.protectionSpace.host];
        if (trustDecision == ApproovTrustDecisionBlock) {
            completionHandler(NSURLSessionAuthChallengeCancelAuthenticationChallenge, NULL);
        } else {
            completionHandler(NSURLSessionAuthChallengePerformDefaultHandling, NULL);
        }
    }
}

/**
 * Handles session authentication challenges. This is handled by Approov pinning and not passed to the original delegate.
 *
 * @param session is the session containing the task whose request requires authentication
 * @param dataTask is the task whose request requires authentication
 * @param challenge is an object that contains the request for authentication
 * @param completionHandler is a handler that must be called providing the outcome of the decision
 */
- (void)URLSession:(NSURLSession *)session
        dataTask:(NSURLSessionDataTask *)dataTask
        didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge
        completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition disposition, NSURLCredential *credential))completionHandler {
    NSLog(@"%@: session task received authentication challenge", TAG);
    if ([challenge.protectionSpace.authenticationMethod isEqualToString:NSURLAuthenticationMethodServerTrust]) {
        ApproovTrustDecision trustDecision = [ApproovServiceNative verifyPins:challenge.protectionSpace.serverTrust forHost:challenge.protectionSpace.host];
        if (trustDecision == ApproovTrustDecisionBlock) {
            completionHandler(NSURLSessionAuthChallengeCancelAuthenticationChallenge, NULL);
        } else {
            completionHandler(NSURLSessionAuthChallengePerformDefaultHandling, NULL);
        }
    }
}

/**
 * Periodically informs the delegate of the progress of sending body content to the server. This is simply passed to the original
 * delegate.
 *
 * https://developer.apple.com/documentation/foundation/urlsessiontaskdelegate/1408299-urlsession?language=objc
 */
- (void)URLSession:(NSURLSession *)session
              task:(NSURLSessionTask *)task
   didSendBodyData:(int64_t)bytesSent
    totalBytesSent:(int64_t)totalBytesSent
totalBytesExpectedToSend:(int64_t)totalBytesExpectedToSend {
    [_originalDelegate URLSession:session task:task didSendBodyData:bytesSent totalBytesSent:totalBytesSent totalBytesExpectedToSend:totalBytesExpectedToSend];
}

/**
 * Tells the delegate that the remote server requested an HTTP redirect. This is simply passed to the original
 * delegate.
 *
 * https://developer.apple.com/documentation/foundation/nsurlsessiontaskdelegate/1411626-urlsession?language=objc
 */
- (void)URLSession:(NSURLSession *)session
              task:(NSURLSessionTask *)task
willPerformHTTPRedirection:(NSHTTPURLResponse *)response
        newRequest:(NSURLRequest *)request
 completionHandler:(void (^)(NSURLRequest *))completionHandler {
    [_originalDelegate URLSession:session task:task willPerformHTTPRedirection:response newRequest:request completionHandler:completionHandler];
}

/**
 * Tells the delegate that the data task received the initial reply (headers) from the server. This is simply passed to
 * the original delegate.
 *
 * https://developer.apple.com/documentation/foundation/urlsessiondatadelegate/1410027-urlsession?language=objc
 */
- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
didReceiveResponse:(NSURLResponse *)response
 completionHandler:(void (^)(NSURLSessionResponseDisposition disposition))completionHandler {
    [_originalDelegate URLSession:session dataTask:dataTask didReceiveResponse:response completionHandler:completionHandler];
}

/**
 * Tells the delegate that the data task has received some of the expected data. This is simply passed to
 * the original delegate.
 *
 * https://developer.apple.com/documentation/foundation/urlsessiondatadelegate/1411528-urlsession?language=objc
 */
- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveData:(NSData *)data {
    [_originalDelegate URLSession:session dataTask:dataTask didReceiveData:data];
}

/**
 * Tells the delegate that the task finished transferring data. This is simply passed to the original delegate.
 *
 * https://developer.apple.com/documentation/foundation/nsurlsessiontaskdelegate/1411610-urlsession?language=objc
 */
- (void)URLSession:(NSURLSession *)session
        task:(NSURLSessionTask *)task
        didCompleteWithError:(NSError *)error {
    if (_originalDelegate != nil) {
        [_originalDelegate URLSession:session task:task didCompleteWithError:error];
        if (error) {
            NSLog(@"%@: session task completed with error: %@", TAG, error.debugDescription);
        }
    }
}

/**
 * Tells the URL session that the session has been invalidated. This is simply passed to the original delegate.
 *
 * https://developer.apple.com/documentation/foundation/nsurlsessiondelegate/1407776-urlsession
 */
- (void)URLSession:(NSURLSession *)session
        didBecomeInvalidWithError:(NSError *)error {
    if (_originalDelegate != nil) {
        [_originalDelegate URLSession:session didBecomeInvalidWithError:error];
        if (error) {
            NSLog(@"%@: session did become invalid with error: %@", TAG, error.debugDescription);
        }
    }
}

@end
