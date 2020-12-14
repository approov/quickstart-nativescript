import {
  HttpErrorResponse,
  HttpEvent,
  HttpHeaders,
  HttpRequest,
  HttpResponse, HttpXhrBackend, XhrFactory
} from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { ExcludedService } from './excluded.service';
// @ts-ignore (FOR ANGULAR ng-packgr)
import { NSApproov, HttpResponse as ApproovHttpResponse } from 'ns-approov-sdk';
import { NSFileSystem } from '@nativescript/angular';
import { isLocalRequest, processLocalFileRequest } from './http-utils';

@Injectable()
export class ApproovSdkHttpXhrBackend extends HttpXhrBackend {
  constructor(xhrFactory: XhrFactory, private nsFileSystem: NSFileSystem, private excludedService: ExcludedService) {
    super(xhrFactory);
  }

  handle(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    if (isLocalRequest(req.url)) {
      return this.handleLocalFileRequest(req.url);
    }

    if (this.excludedService.skipSSLPinning(req)) {
      return super.handle(req);
    }

    return request(req).pipe(
      map((resp: ApproovHttpResponse) => {
        return new HttpResponse({
          body: resp.content,
          headers: new HttpHeaders(resp.headers),
          status: resp.statusCode,
          statusText: resp.reason,
          url: req.url
        });
      }),
      catchError((error: ApproovHttpResponse) => {
        return throwError(new HttpErrorResponse({
          error: error.content,
          status: error.statusCode,
          headers: error.headers as any,
          statusText: error.reason,
          url: req.url
        }));
      })
    );
  }

  private handleLocalFileRequest(url: string): Observable<HttpEvent<any>> {
    return processLocalFileRequest(
      url,
      this.nsFileSystem,
      createSuccessResponse,
      createErrorResponse
    );
  }
}

export function request(req: HttpRequest<any>) {
  const method = req.method as ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD');
  return from(NSApproov.request({
    url: req.url,
    body: req.body,
    method,
    headers: mapHeaders(req),
    allowLargeResponse: true
  }));
}

export function mapHeaders(req: HttpRequest<any>): { [key: string]: string | string[] } {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  req.headers.keys().forEach((key: string) => {
    headers[key] = req.headers.getAll(key).join(' ');
  });

  return headers;
}

function createSuccessResponse(
  url: string,
  body: any,
  status: number): HttpEvent<any> {
  return new HttpResponse({
    url,
    body,
    status,
    statusText: 'OK'
  });
}

function createErrorResponse(
  url: string,
  body: any,
  status: number): HttpErrorResponse {
  return new HttpErrorResponse({
    url,
    error: body,
    status,
    statusText: 'ERROR'
  });
}
