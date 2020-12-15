import { NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { AppComponent } from './app.component';
import { NativeScriptHttpClientModule, NativeScriptModule } from '@nativescript/angular';

/* Uncomment for Approov */
// import { ApproovSdkPinningHttpClientModule } from '@approov/ns-approov-sdk/angular';
// import { NSApproov } from '@approov/ns-approov-sdk';

@NgModule({
  bootstrap: [
    AppComponent
  ],
  imports: [
    NativeScriptModule,
    NativeScriptHttpClientModule, // Comment this when using Approov

    /* Uncomment for Approov */
    // ApproovSdkPinningHttpClientModule,
  ],
  declarations: [
    AppComponent,
  ],
  providers: [],
  schemas: [
    NO_ERRORS_SCHEMA
  ]
})
export class AppModule {
  constructor() {
    /* Uncomment for Approov */
    // NSApproov.initialize().then().catch(console.log);
    // NSApproov.setApproovHeader('shapes.approov.io', { token: 'Approov-Token', binding: 'Authorization' });
  }
}
