import { NgModule } from '@angular/core';
import { ExcludedService } from './excluded.service';
import { ApproovSdkHttpXhrBackend } from './approov-sdk-http-xhr.backend';
import { NSFileSystem } from '@nativescript/angular';
import { HttpBackend, HttpClientModule } from '@angular/common/http';

export { ApproovSdkHttpXhrBackend } from './approov-sdk-http-xhr.backend';

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
