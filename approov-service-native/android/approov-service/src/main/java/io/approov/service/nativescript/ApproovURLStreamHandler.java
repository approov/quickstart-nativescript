//
// MIT License
//
// Copyright (c) 2016-present, Critical Blue Ltd.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
// ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH
// THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

package io.approov.service.nativescript;

import android.util.Log;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.io.IOException;

import javax.net.ssl.HttpsURLConnection;

// ApproovURLStreamHandler provides a special URLStreamHandler for adding Approov protection to
// requests. This becomes the default https handlerb but is able to delegate network functionality
// to the original.
class ApproovURLStreamHandler extends URLStreamHandler {
    // logging tag
    private static final String TAG = "ApproovService";

    // the original URLStreamHandler that we delegate to
    private URLStreamHandler delegate;

    // delegate open connection method to be called, or null if it could not be found
    Method delegateOpenConnMethod;

    /**
     * Create a new ApproovURLStreamHandler wth the original https URLStreamHandler implementation
     * that should be delegated to.
     *
     * @param delegate is the original https URLSteamHandler
     */
    public ApproovURLStreamHandler(URLStreamHandler delegate) {
        // use reflection to find the method on the delegate that implements openConnection so we
        // can invoke it as required
        this.delegate = delegate;
        delegateOpenConnMethod = null;
        try {
            delegateOpenConnMethod = delegate.getClass().getDeclaredMethod("openConnection", URL.class);
            Log.d(TAG, "delegate openConnection method found in class");
        }
        catch (NoSuchMethodException e) {
            // the method may actually be defined on the superclass so try that next
            try {
                delegateOpenConnMethod = delegate.getClass().getSuperclass().getDeclaredMethod("openConnection", URL.class);
                Log.d(TAG, "delegate openConnection method found in superclass");
            }
            catch (NoSuchMethodException ee) {
                Log.e(TAG, "delegate openConnection method not found: " + ee);
            }
        }

        // the delegate openConnection is not normally accessible since it is declared as "protected" so make it accessible
        if (delegateOpenConnMethod != null)
            delegateOpenConnMethod.setAccessible(true);
    }

    @Override
    protected int getDefaultPort() {
        return 443;
    }

    @Override
    protected URLConnection openConnection(URL url) throws IOException {
        // if we failed to find the delegate openConnection method then all requests fail
        if (delegateOpenConnMethod == null)
            throw new IOException("delegate openConnection method was not found");

        // we substitute any query parameters
        URL substitutedURL = ApproovServiceNative.substituteQueryParams(url);

        // now we delegate to the original openConnection method and wrap the result in
        // an Approov protected connection
        try {
            URLConnection urlConn = (URLConnection)delegateOpenConnMethod.invoke(delegate, substitutedURL);
            if (urlConn instanceof HttpsURLConnection) {
                // if the result is an https connection then we wrap it with Approov protection
                return new ApproovHttpsURLConnection(url, (HttpsURLConnection) urlConn);
            }
            else
                // return all other connection types unwrapped
                return urlConn;
        }
        catch (IllegalAccessException e) {
            Log.e(TAG, "openConnection method illegal access: " + e);
            throw new IOException("openConnection method illegal access");
        }
        catch (InvocationTargetException e) {
            if (e.getCause() instanceof IOException) {
                // handle the delegated openConnection throwing an IOException and rethrow it
                Log.e(TAG, "openConnection throws IOException: " + e.getCause());
                throw (IOException) e.getCause();
            }
            else {
                // we have an unexpected exception from the invocation
                Log.e(TAG, "openConnection unexpected invocation exception: " + e);
                throw new IOException("openConnection unexpected invocation exception");
            }
        }
    }
}
