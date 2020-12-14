import {
  HttpRequestOptions,
  HttpResponse,
  ApproovHeader
} from './approov-sdk.common';
import { NSApproovCommon } from './approov-sdk.common';

export declare class NSApproov extends NSApproovCommon {
  static setApproovHeader(domain: string, approovHeader: ApproovHeader): void;
  static initialize(initialConfigFileName?: string): Promise<void>;
  static getApproovTokenSync(url: string): any;
  static getDomainHeader(domain: string): ApproovHeader;
  static request(opts: HttpRequestOptions): Promise<HttpResponse>;
}

