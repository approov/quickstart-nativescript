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

#import "ApproovNSInterceptor.h"
#import "ApproovPinningDelegate.h"
#import "ApproovSessionTaskObserver.h"
#import "RSSwizzle.h"

// the implementation in this file is based on the methods used in the networking stack of NativeScript implemented here:
// https://github.com/NativeScript/NativeScript/blob/master/packages/core/http/http-request/index.ios.ts
// if this implementation changes and different undelying networking methods are used then the methods that are swizzled will need to
// be updated

/// NativeScript interceptor that is able to add Approov onto requests being made by the
/// built-in networking stack
@implementation ApproovNSInterceptor

// tag for logging
static NSString *TAG = @"ApproovService";

// sessions to which pinning has been applied in the NativeScript networking implementation (the first entry is for "defaultSession" and the second
// entry for "sessionNotFollowingRedirects")
static NSURLSession *pinnedSession[2];

// shows whether pinned sessions have been bound correctly via the setup checks
static BOOL pinnedSessionVerified[2];

// session task observer for initating Approov protection when the task is initially resumed
static ApproovSessionTaskObserver *sessionTaskObserver;

/**
 * Hooks the NativeScript networking stack with the interceptor.
 */
+ (void)hookNetworking {
    // create a session task observer for state transitions that can actually add the
    // Approov protection
    sessionTaskObserver = [[ApproovSessionTaskObserver alloc] init];
    
    // clear the pinned sessions so they can be set by subsequent networking events
    pinnedSession[0] = nil;
    pinnedSession[1] = nil;
    pinnedSessionVerified[0] = NO;
    pinnedSessionVerified[1] = NO;
    
    // swizzle the NSURLSession methods that the NativeScript networking stack uses
    [ApproovNSInterceptor swizzleSessionWithConfiguration];
    [ApproovNSInterceptor swizzleDataTaskWithRequest];
    [ApproovNSInterceptor swizzleSessionTask];
}

/**
 * Checks if pinned sessions have been verified by subsquent networking stack calls that check that the correct sessions have been
 * identified as belonging to the NativeScript networking stack.
 *
 * @return YES if the sessions are verified, NO otherwise
 */
+ (BOOL)arePinnedSessionsVerified {
    return pinnedSessionVerified[0] && pinnedSessionVerified[1];
}

/**
 * Swizzles the NSURLSession sessinWithConfiguratiion creation method that is used by
 * the NativeScript networking stack. These sessions are only created once by NativeScript,
 * one for normal networking requests and another if redirects are not being followed that
 * uses a delegate. This swizzling allows us to intercept the creation of the sessions
 * and ensure that a special pinning delegate can be used that applies the Approov dynamic
 * pins.
 */
+ (void)swizzleSessionWithConfiguration {
    RSSwizzleClassMethod(NSClassFromString(@"NSURLSession"),
        @selector(sessionWithConfiguration:delegate:delegateQueue:),
        RSSWReturnType(NSURLSession *),
        RSSWArguments(NSURLSessionConfiguration * _Nonnull configuration, id _Nullable delegate, NSOperationQueue * _Nullable queue),
        RSSWReplacement({
            // determine the pinned session slot to use - we have one for no delegate ("defaultSessions") and one for ("sessionNotFollowingRedirects")
            // and proceed if the slot is not already filled
            int slot = (delegate != nil) ? 1 : 0;
            if (pinnedSession[slot] == nil) {
                // get the configuration and delegate class names for logging and to compare against the expected to
                // further ensure we only match against the NativeScript networking calls
                NSString *configurationClassName = NSStringFromClass([configuration class]);
                NSString *delegateClassName = @"null";
                if (delegate != nil)
                    delegateClassName = NSStringFromClass([delegate class]);

                // check the configuration name and delegate class names are as expected
                if ([configurationClassName isEqualToString:@"NSURLSessionConfiguration"] &&
                    ([delegateClassName isEqualToString:@"null"] ||
                     [delegateClassName isEqualToString:@"NSURLSessionTaskDelegateImpl"])) {
                    // call the original method but provide the pjnning delegate instead of the one provided
                    PinningURLSessionDelegate *pinningDelegate = [PinningURLSessionDelegate createWithDelegate:delegate];
                    NSURLSession *session = RSSWCallOriginal(configuration, pinningDelegate, queue);

                    // remember this particular NSURLSession since we need to recognize it for future data task requests
                    pinnedSession[slot] = session;
                    
                    // provide the created session
                    NSLog(@"%@: pinned session creation with configuration:%@ delegate:%@ slot:%d",
                          TAG, configurationClassName, delegateClassName, slot);
                    return session;
                }
                else
                    NSLog(@"%@: unmatched session creation with configuration:%@ delegate:%@ slot:%d",
                          TAG, configurationClassName, delegateClassName, slot);
            }

            // if we don't want to intercept the session then we just call the original method unmodified
            return RSSWCallOriginal(configuration, delegate, queue);
        })
    );
}

/**
 * Swizzles the NSURLSessionDataTask  dataTaskWithRequest creation method that
 * is used by the NativeScript networking stack. This allows us to intercept the creation of
 * individual networking requests and remember the session data tasks being created. They
 * are initially created in a suspended state and Approov protection can then be added when
 * they are resumed.
 */
+ (void)swizzleDataTaskWithRequest {
    RSSwizzleInstanceMethod(NSClassFromString(@"NSURLSession"),
        @selector(dataTaskWithRequest:completionHandler:),
        RSSWReturnType(NSURLSessionDataTask *),
        RSSWArguments(NSURLRequest * _Nonnull request, CompletionHandlerType completionHandler),
        RSSWReplacement({
            NSString *url = request.URL.absoluteString;
            if ([url hasPrefix:@"https://setup/"]) {
                // we have a setup request that is sent immediately after initialization so first
                // we just call the original handler that we have hooked
                NSURLSessionDataTask *sessionDataTask = RSSWCallOriginal(request, completionHandler);
                NSString *taskID = [sessionTaskObserver sessionTaskID:sessionDataTask];
                
                // now see if we are in one of the pinned sessions and log the result of that
                if (self == pinnedSession[0]) {
                    pinnedSessionVerified[0] = YES;
                    NSLog(@"%@: setup request %@ with task %@ verified pinned session slot 0", TAG, url, taskID);
                }
                else if (self == pinnedSession[1]) {
                    pinnedSessionVerified[1] = YES;
                    NSLog(@"%@: setup request %@ with task %@ verified pinned session slot 1", TAG, url, taskID);
                }
                else
                    NSLog(@"%@: setup request %@ with task %@ failed", TAG, url, taskID);
                
                // we force an immediate error as soon as the new session data task is run as we don't
                // want to impose any actual netwoking overhead
                NSDictionary *userInfo = @{
                      NSLocalizedDescriptionKey: NSLocalizedString(@"networking setup call", nil)
                };
                NSError *error = [[NSError alloc] initWithDomain:@"approov" code:499 userInfo:userInfo];
                [sessionTaskObserver addWithTask:sessionDataTask forceError:error];
                [sessionTaskObserver addWithTask:sessionDataTask completionHandler:completionHandler];
                return sessionDataTask;
            }
            else if (((self == pinnedSession[0]) && pinnedSessionVerified[0]) ||
                     ((self == pinnedSession[1]) && pinnedSessionVerified[1])) {
                // we are intercepting a pinned data request but this is being done in the context of a thread that we
                // cannot block, so we have to allow the session data task to be created and intercept it when its state is
                // about to be changed to be run and then we can actual make network requests for Approov protection -
                // first we call the original function that we have hooked
                NSURLSessionDataTask *sessionDataTask = RSSWCallOriginal(request, completionHandler);
                NSString *taskID = [sessionTaskObserver sessionTaskID:sessionDataTask];
                NSLog(@"%@: intercepting pinned dataTaskWithRequest %@ %@ with task %@", TAG, request.HTTPMethod,
                      request.URL, taskID);
                
                // we remember the completion handler associated with the task so we can call it if we need to cancel it later -
                // this also registers the task so we can intercept its subsequent task resume
                [sessionTaskObserver addWithTask:sessionDataTask completionHandler:completionHandler];
                return sessionDataTask;
            }
            else {
                // if the data task creation is for a different (unpinned) session then we don't add Approov
                return RSSWCallOriginal(request, completionHandler);
            }
        }),
    0, NULL);
}


/**
 * Swizzles the NSURLSessionTask resume method that is called when a task is to be transitioned
 * from its initial suspended state into the running state. This provides an opportunity to intercept (and
 * nullify) this inital call to initiate the Approov protection addition in a different thread so that the
 * calling thread is not blocked.
 */
+ (void)swizzleSessionTask {
    RSSwizzleInstanceMethod(NSClassFromString(@"NSURLSessionTask"),
        @selector(resume),
        RSSWReturnType(void),
        RSSWArguments(),
        RSSWReplacement({
            if ([sessionTaskObserver shouldExecuteTaskResume:(NSURLSessionTask *)self])
                RSSWCallOriginal();
        }),
    0, NULL);
}
@end
