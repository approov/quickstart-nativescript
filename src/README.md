# NativeScript Approov Plugin

This provides the source code for the plugin that provides Approov functionality for NativeScript applications on Android and iOS.

In order to minimize the necessary code changes the integration hooks the underlying network stack in order to add dynamic pinning and Approov functionality (such as Approov token addition) as required.

## Structure

A Typescript interface allows configuration and control of Approov, and for accessing more advanced functionality. This Typescript layer actually bridges to a native code layer that sits on top of the Approov SDK itself. This bridging layer has to be pre-built and packaged with the plugin. Its source code can be found in the `approov-service-native` folder at the top level of the repo.

For Android the Approov SDK itself is included via a gradle jitpack dependency to the repo holding the latest SDK. For iOS the SDK is actually included in this repo.

## Example Comparator Project

The structure of this plugin project seems unusually complex compared to most plugins which only include typescript code, and it requires the use of bridge typings to cross call to native libraries.

This project requires custom native code in addition to the bridging layer and the inclusion of the proprietary Approov SDK itself. The closest exemplar can be found at `https://github.com/NativeScript/plugins/tree/main/packages/local-notifications`. The `local-notifications` plugin also requires a special Android `.aar` and `.xcframework` library.

## Development

For development it is not advised to include the plugin locally using a file path. Although this is supported, and mostly works, this seems to generate numerous issues with the build process because it results in a file system symbolic link being generated.

Instead for local development it is advised to ganerate a plugin `.tgz` and install that for each required change.

A local plugin can be generatee by changing the working directory to `publish` and executing `./pack.sh`. This generates a new package in `publish/package/approov-nativescript-approov.x.y.z.tgz`. For clarity it is suggested the version number is changed in `src/package.json` each time.

Add it to an app project with `ns plugin add ${REPO-ROOT}/publish/package/approov-nativescript-approov.x.y.z.tgz`. This will automatically replace any previous version of the plugin.
