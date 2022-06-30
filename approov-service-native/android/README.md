# ApproovServiceNative Layer

This is provided as an Android project that builds an AAR. This AAR can then be copied into the plugin src project itself when functionality is updated.

## Building
- Open this folder as "an existing project" in Android Studio
- Make modifications as required
- Use `Build -> Make Project` menu item to build a new AAR
- The output will be generate in `approov-service/build/outputs/aar/approov-service-release.aar`
- Copy the release AAR from the repo root, run `cp approov-service-native/android/approov-service/build/outputs/aar/approov-service-release.aar src/platforms/android/` 

## Typings
If a change is made to the interface of the `ApproovServiceNative` layer then it is necessary to regenerate the typings, which provides information about the interface to the typescript layer.

It is not possible to generate Android typings using the `TNS_TYPESCRIPT_DECLARATIONS_PATH="$(pwd)/typings"` method used for iOS. This seems to cause the build to hang indefinitely.

Instead the Android DTS generator must be used as described here:
https://v7.docs.nativescript.org/core-concepts/android-runtime/metadata/generating-typescript-declarations

Run the DTS generator as follows with the new AAR copied to the plugin:

`java -jar build/libs/dts-generator.jar -input ${REPO-ROOT}/src/platforms/android/approov-service-release.aar`

This then generates the typings in the `out` directory as `android.d.ts`. Copy this to the `typings` directory with the correct name as follows:

`cp out/android.d.ts ${REPO-ROOT}/src/platforms/android/typings/approov-service-native.d.ts`

The updated interface can then be called from the Typescript layer. The interface layer can be edited down to remove superfluous definitions, only retaining `ApproovResult` and `ApproovServiceNative`.
