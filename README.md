# Approov Quickstart: NativeScript

This provides support for using [Approov](https://www.approov.io) in [`NativeScript`](https://docs.nativescript.org/) mobile applications, including Angular and Vue. Support is provided for adding Approov protection to API requests made using the [`Http module`](https://docs.nativescript.org/http.html) and also Angular [`Http`](https://v7.docs.nativescript.org/angular/ng-framework-modules/http) requests. Furthermore, requests using [`Axios`](https://axios-http.com/) are also supported. If this is not your situation then check if there is a more relevant quickstart guide available.

This quickstart provides the basic steps for integrating Approov into your app. A more detailed step-by-step guide using a [Shapes App Example](https://github.com/approov/quickstart-nativescript/blob/main/SHAPES-EXAMPLE.md) is also available.

To follow this guide you should have received an onboarding email for a trial or paid Approov account.

Note that for Android the minimum supported version is 5.1 (SDK level 22). For iOS, only 64-bit devices are supported on iOS 10 or above.

## ADDING THE APPROOV PLUGIN

Add the Approov plugin to your existing App with the following command:

```
ns plugin add @approov/nativescript-approov
```

## ACTIVATING APPROOV

In order to use Approov you should include the `ApproovService`, which allows you to make certain calls to Approov from your application, as follows:

```Javascript
import { ApproovService } from '@approov/nativescript-approov';
```

You must initialize the `ApproovService` as follows:

```Javascript
ApproovService.initialize("<enter-your-config-string-here>");
```

You should place this in your main app file so that it is executed immediately the app starts. The `<enter-your-config-string-here>` is a custom string that configures your Approov account access. This will have been provided in your Approov onboarding email.

Once the initialization has been made, Approov protection can be automatically added to network requests. Note that you must ensure that no network requests are executed prior to the initialization call being made.

### Angular Initialization

For an Angular app you should place the initialization call in the `constructor` of the App itself as follows:

```Javascript
export class AppModule {
  constructor() {
    ApproovService.initialize("<enter-your-config-string-here>");
  }
}
```

### Vue Initialization

For a Vue app you should place the initialization call in the `beforeCreate` of the components that can be initially shown in the app`:

```Javascript
export default Vue.extend({
  beforeCreate() {
     ApproovService.initialize("<enter-your-config-string-here>");
  }
```

## CHECKING IT WORKS
Once the initialization is called, it is possible for any network requests to have Approov tokens or secret substitutions made. Initially you won't have set which API domains to protect, so the requests will be unchanged. It will have called Approov though and made contact with the Approov cloud service. You will see `ApproovService` logging indicating `UNKNOWN_URL` (Android) or `unknown URL` (iOS).

On Android, you can see logging using [`logcat`](https://developer.android.com/studio/command-line/logcat) output from the device. You can see the specific Approov output using `adb logcat | grep ApproovService`. On iOS, look at the console output from the device using the [Console](https://support.apple.com/en-gb/guide/console/welcome/mac) app from MacOS. This provides console output for a connected simulator or physical device. Select the device and search for `ApproovService` to obtain specific logging related to Approov.

Your Approov onboarding email should contain a link allowing you to access [Live Metrics Graphs](https://approov.io/docs/latest/approov-usage-documentation/#metrics-graphs). After you've run your app with Approov integration you should be able to see the results in the live metrics within a minute or so. At this stage you could even release your app to get details of your app population and the attributes of the devices they are running upon.

## NEXT STEPS
To actually protect your APIs there are some further steps. Approov provides two different options for protection:

* [API PROTECTION](https://github.com/approov/quickstart-nativescript/blob/main/API-PROTECTION.md): You should use this if you control the backend API(s) being protected and are able to modify them to ensure that a valid Approov token is being passed by the app. An [Approov Token](https://approov.io/docs/latest/approov-usage-documentation/#approov-tokens) is short lived crytographically signed JWT proving the authenticity of the call.

* [SECRETS PROTECTION](https://github.com/approov/quickstart-nativescript/blob/main/SECRETS-PROTECTION.md): If you do not control the backend API(s) being protected, and are therefore unable to modify it to check Approov tokens, you can use this approach instead. It allows app secrets, and API keys, to be protected so that they no longer need to be included in the built code and are only made available to passing apps at runtime.

Note that it is possible to use both approaches side-by-side in the same app, in case your app uses a mixture of 1st and 3rd party APIs.

See [REFERENCE](https://github.com/approov/quickstart-nativescript/blob/main/REFERENCE.md) for a complete list of all of the Approov related methods.
