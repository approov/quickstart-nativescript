import { Headers } from '@nativescript/core/http';
import { knownFolders } from '@nativescript/core/file-system';
import * as applicationSettings from '@nativescript/core/application-settings';

export interface RequestBody {
  [key: string]: any;
}

export interface HttpRequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  headers?: Headers;
  body?: RequestBody | FormData | string;
  timeout?: number; // Default is 10
  /**
   * On Android large responses may crash the app (fi. https://httpbin.org/bytes/10000).
   * By setting this to true we allow large responses on the main thread (which this plugin currently does).
   * Note that once set to true, this policy remains active until the app is killed.
   */
  allowLargeResponse?: boolean;
}

export interface HttpResponse {
  headers?: Headers;
  statusCode?: number;
  content?: any;
  reason?: string;
  reject?: boolean;
}

export interface ApproovHeader {
  binding?: string;
  token: string;
}

export function dataObject(data: any): any {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      return data;
    }
  }
  return data || {};
}

export const METHODS = {
  'GET': 'get',
  'HEAD': 'head',
  'DELETE': 'delete',
  'POST': 'post',
  'PUT': 'put',
  'PATCH': 'patch'
};

export const ApproovConstants = {
  DYNAMIC_CONFIG: 'APPROOV_DYNAMIC_CONFIG',
  INITIAL_CONFIG: 'approov-initial.config',
  DEFAULT_HEADER: 'Approov-Token',
};

const approovHeaders: Map<string, ApproovHeader> = new Map<string, ApproovHeader>();
let approovInitialized = false;

export abstract class NSApproovCommon {
  static async initialize(_: string): Promise<void> {
    throw new Error('Method not overridden.');
  }

  /**
   * Returns the application's dynamic configuration string from non-volatile storage.
   *
   * The default implementation retrieves the string from shared preferences.
   */
  static getDynamicConfig(): string | null {
    return applicationSettings.getString(ApproovConstants.DYNAMIC_CONFIG, null);
  }

  /**
   * Retrieves the initial config string from application assets.
   * This file is automatically added in the application assets when building the plugin.
   * @protected
   */
  protected static async getInitialConfig(initialConfigFileName: string): Promise<string> {
    let assetsDir = knownFolders.currentApp().getFolder('assets');
    if (!assetsDir.contains(initialConfigFileName)) {
      return Promise.reject(`approov-sdk => Config file {${initialConfigFileName}} does not exists in the assets directory`);
    }

    return assetsDir.getFile(initialConfigFileName).readText('UTF-8');
  }

  static applyCertificatePinning(): void {
    throw new Error('ns-approov-sdk => Base method not overridden.');
  }

  /**
   * Sets the approov header for a domain so that
   * in case of multiple domains we can have different approov headers.
   *
   * Example: {'shapes.approov.io': {'token': 'Approov-Token', binding: 'Authorization'}, 'dev.approov.io': {'token': 'Authorization'}}
   */
  static setApproovHeader(domain: string, approovHeader: ApproovHeader): void {
    approovHeaders.set(domain, approovHeader);
  }

  /**
   * Retrieves the Approov header from the map.
   * If not header is returned then a default header is returned.
   */
  static getDomainHeader(domain: string): ApproovHeader {
    return {
      token: ApproovConstants.DEFAULT_HEADER,
      ...(approovHeaders.get(domain) || {}),
    };
  }

  /**
   * Returns if ApproovSdk Is initialized
   */
  static isApproovInitialized(): boolean {
    return approovInitialized;
  }

  static isMultipartFormRequest(headers: Record<string, string | string[]>): boolean {
    return headers['Content-Type'].includes('application/x-www-form-urlencoded') || headers['Content-Type'].includes('multipart/form-data');
  }

  static set approovInitialized(initialized: boolean) {
    approovInitialized = initialized;
  }
}

export const getHostnameFromUrl = (url) => {
  // run against regex
  const matches = url.match(/^https?:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
  // extract hostname (will be null if no match is found)
  return matches && matches[1];
};
