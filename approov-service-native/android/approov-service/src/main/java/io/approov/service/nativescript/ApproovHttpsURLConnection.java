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

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ProtocolException;
import java.net.URL;
import java.security.Permission;
import java.security.Principal;
import java.security.cert.Certificate;
import java.util.List;
import java.util.Map;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLPeerUnverifiedException;
import javax.net.ssl.SSLSocketFactory;

// ApproovHttpsURLConnection provides an implementation of HttpsUrlConnection that is
// provided for an intercepted connection. This is responsible for pinning the connection
// and potentially adding an Approov token or substituting secrets. The actual networking
// is performed by the delegate implementation provided upon construction. Apart from the
// connect method, this simply delegates all other calls. This relies on the fact that
// the requests we want to protect always make an explicit "connect" call.
class ApproovHttpsURLConnection extends HttpsURLConnection {
    // the wrapped HttpsURLConnection that is being delegated to
    private HttpsURLConnection delegate;

    /**
     * Construct a new ApproovHttpsURLConnection with the original HttpsURLConnection that
     * is being wrapped for delegation.
     *
     * @param url is the URL for the connection
     * @param delegate is the wrapped HttpsURLConnection being delegated to
     */
    public ApproovHttpsURLConnection(URL url, HttpsURLConnection delegate) {
        super(url);
        this.delegate = delegate;
    }

    @Override
    public String getCipherSuite() {
        return delegate.getCipherSuite();
    }

    @Override
    public HostnameVerifier getHostnameVerifier() {
        return delegate.getHostnameVerifier();
    }

    @Override
    public Certificate[] getLocalCertificates() {
        return delegate.getLocalCertificates();
    }

    @Override
    public Principal getLocalPrincipal() {
        return delegate.getLocalPrincipal();
    }

    @Override
    public Principal getPeerPrincipal() throws SSLPeerUnverifiedException {
        return delegate.getPeerPrincipal();
    }

    @Override
    public SSLSocketFactory getSSLSocketFactory() {
        return delegate.getSSLSocketFactory();
    }

    @Override
    public Certificate[] getServerCertificates() throws SSLPeerUnverifiedException {
        return delegate.getServerCertificates();
    }

    @Override
    public void setHostnameVerifier(HostnameVerifier v) {
        delegate.setHostnameVerifier(v);
    }

    @Override
    public void setSSLSocketFactory(SSLSocketFactory sf) {
        delegate.setSSLSocketFactory(sf);
    }

    @Override
    public void connect() throws IOException {
        // we add Approov to the real connection and then just delegate to the original handler
        ApproovServiceNative.addApproov(delegate);
        delegate.connect();
    }

    @Override
    public void disconnect() {
        delegate.disconnect();
    }
    
    @Override public InputStream getErrorStream() {
        return delegate.getErrorStream();
    }

    @Override
    public String getRequestMethod() {
        return delegate.getRequestMethod();
    }

    @Override
    public int getResponseCode() throws IOException {
        return delegate.getResponseCode();
    }

    @Override
    public String getResponseMessage() throws IOException {
        return delegate.getResponseMessage();
    }

    @Override
    public void setRequestMethod(String method) throws ProtocolException {
        delegate.setRequestMethod(method);
    }

    @Override
    public boolean usingProxy() {
        return delegate.usingProxy();
    }

    @Override
    public boolean getInstanceFollowRedirects() {
        return delegate.getInstanceFollowRedirects();
    }

    @Override
    public void setInstanceFollowRedirects(boolean followRedirects) {
        delegate.setInstanceFollowRedirects(followRedirects);
    }

    @Override
    public boolean getAllowUserInteraction() {
        return delegate.getAllowUserInteraction();
    }

    @Override
    public Object getContent() throws IOException {
        return delegate.getContent();
    }

    @SuppressWarnings("unchecked") // Spec does not generify
    @Override
    public Object getContent(Class[] types) throws IOException {
        return delegate.getContent(types);
    }

    @Override
    public String getContentEncoding() {
        return delegate.getContentEncoding();
    }

    @Override
    public int getContentLength() {
        return delegate.getContentLength();
    }

    @Override
    public String getContentType() {
        return delegate.getContentType();
    }

    @Override
    public long getDate() {
        return delegate.getDate();
    }

    @Override
    public boolean getDefaultUseCaches() {
        return delegate.getDefaultUseCaches();
    }

    @Override
    public boolean getDoInput() {
        return delegate.getDoInput();
    }

    @Override
    public boolean getDoOutput() {
        return delegate.getDoOutput();
    }

    @Override
    public long getExpiration() {
        return delegate.getExpiration();
    }

    @Override
    public String getHeaderField(int pos) {
        return delegate.getHeaderField(pos);
    }

    @Override
    public Map<String, List<String>> getHeaderFields() {
        return delegate.getHeaderFields();
    }

    @Override
    public Map<String, List<String>> getRequestProperties() {
        return delegate.getRequestProperties();
    }

    @Override
    public void addRequestProperty(String field, String newValue) {
        delegate.addRequestProperty(field, newValue);
    }

    @Override
    public String getHeaderField(String key) {
        return delegate.getHeaderField(key);
    }

    @Override
    public long getHeaderFieldDate(String field, long defaultValue) {
        return delegate.getHeaderFieldDate(field, defaultValue);
    }

    @Override
    public int getHeaderFieldInt(String field, int defaultValue) {
        return delegate.getHeaderFieldInt(field, defaultValue);
    }

    @Override
    public String getHeaderFieldKey(int position) {
        return delegate.getHeaderFieldKey(position);
    }

    @Override
    public long getIfModifiedSince() {
        return delegate.getIfModifiedSince();
    }

    @Override
    public InputStream getInputStream() throws IOException {
        return delegate.getInputStream();
    }

    @Override
    public long getLastModified() {
        return delegate.getLastModified();
    }

    @Override
    public OutputStream getOutputStream() throws IOException {
        return delegate.getOutputStream();
    }

    @Override
    public Permission getPermission() throws IOException {
        return delegate.getPermission();
    }

    @Override
    public String getRequestProperty(String field) {
        return delegate.getRequestProperty(field);
    }

    @Override
    public URL getURL() {
        return delegate.getURL();
    }

    @Override
    public boolean getUseCaches() {
        return delegate.getUseCaches();
    }

    @Override
    public void setAllowUserInteraction(boolean newValue) {
        delegate.setAllowUserInteraction(newValue);
    }

    @Override
    public void setDefaultUseCaches(boolean newValue) {
        delegate.setDefaultUseCaches(newValue);
    }

    @Override
    public void setDoInput(boolean newValue) {
        delegate.setDoInput(newValue);
    }

    @Override
    public void setDoOutput(boolean newValue) {
        delegate.setDoOutput(newValue);
    }

    @Override
    public void setIfModifiedSince(long newValue) {
        delegate.setIfModifiedSince(newValue);
    }

    @Override
    public void setRequestProperty(String field, String newValue) {
        delegate.setRequestProperty(field, newValue);
    }

    @Override
    public void setUseCaches(boolean newValue) {
        delegate.setUseCaches(newValue);
    }

    @Override
    public void setConnectTimeout(int timeoutMillis) {
        delegate.setConnectTimeout(timeoutMillis);
    }

    @Override
    public int getConnectTimeout() {
        return delegate.getConnectTimeout();
    }

    @Override
    public void setReadTimeout(int timeoutMillis) {
        delegate.setReadTimeout(timeoutMillis);
    }

    @Override
    public int getReadTimeout() {
        return delegate.getReadTimeout();
    }

    @Override
    public String toString() {
        return delegate.toString();
    }

    @Override
    public void setFixedLengthStreamingMode(int contentLength) {
        delegate.setFixedLengthStreamingMode(contentLength);
    }

    @Override
    public void setChunkedStreamingMode(int chunkLength) {
        delegate.setChunkedStreamingMode(chunkLength);
    }
}
