import { NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { AppComponent } from './app.component';
import { NativeScriptHttpClientModule, NativeScriptModule } from '@nativescript/angular';

// UNCOMMENT FOR APPROOV
//import { ApproovService } from '@approov/nativescript-approov';

@NgModule({
  bootstrap: [
    AppComponent
  ],
  imports: [
    NativeScriptModule,
    NativeScriptHttpClientModule
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
    // UNCOMMENT FOR APPROOV
    //ApproovService.initialize("<enter-your-config-string-here>");

    // UNCOMMENT FOR APPROOV WITH SECRETS PROTECTION
    //ApproovService.addSubstitutionHeader("Api-Key", "");
  }
}
