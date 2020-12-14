import { NgModule } from '@angular/core';
import { ApproovSdkHttpXhrBackend } from './approov-sdk-http-xhr.backend';
import { ExcludedService } from './excluded.service';
import { HttpBackend, HttpClientModule } from '@angular/common/http';
import { NSFileSystem } from 'nativescript-angular/file-system/ns-file-system';

@NgModule({
  providers: [
    ExcludedService,
    ApproovSdkHttpXhrBackend,
    NSFileSystem,
    { provide: HttpBackend, useExisting: ApproovSdkHttpXhrBackend },
  ],
  imports: [HttpClientModule],
  exports: [HttpClientModule],
})
export class ApproovSdkPinningHttpClientModule {
}
