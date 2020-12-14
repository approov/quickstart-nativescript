import { NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptModule } from 'nativescript-angular';
import { AppComponent } from './app.component';

// Uncomment and add to NgModule imports if you need to use two-way binding
// import { NativeScriptFormsModule } from "nativescript-angular/forms";

// Uncomment and add to NgModule imports if you need to use the HttpClient wrapper
import { NativeScriptHttpClientModule } from 'nativescript-angular/http-client';

/* Uncomment for Approov */
// import { ApproovSdkPinningHttpClientModule } from 'ns-approov-sdk/angular';
// import { NSApproov } from 'ns-approov-sdk';

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
/*
Pass your application module to the bootstrapModule function located in main.ts to start your app
*/
export class AppModule {
    constructor() {
        /* Uncomment for Approov */
        // NSApproov.initialize().then().catch(console.log);
        // NSApproov.setApproovHeader('shapes.approov.io', { token: 'Approov-Token', binding: 'Authorization' });
    }
}
