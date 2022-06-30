# ApproovServiceNative Layer

This is provided as an Xcode project that builds a `.framework`. It is necessary to build a `.framework` for both real devices and simulators, and to then manually create a `.xcframework` to be used in the plugin itself.

Note that this project contains a reference to the `Approov.xcframework` SDK that is placed at `src/platforms/ios`. This must contain `bitcode` and this library is also built with bitcode support.

## Building
- Open the project at `approov-service-native/ios/ApproovServiceNative.xcodeproj`
- Make the necessary changes to the project code
- Clear the build folder with the `Product -> Clean Build Folder` menu item
- Build for the current target (either simulator or device)
- Now build for the other device, changing the target via the `Product -> Destination` menu item. Note that for the simulator you do not want the `Mac Catalyst` option so it is better to select any device from the `iOS Simulator` option to generate the correct set of architectures
- Now open the build folder with `Product -> Show Build Folder in Finder` menu item
- You can then open a shell at in the `Products` folder by right-clicking and selecting `New Terminal at Folder`
- Remove the existing `.xcframework` by executing `rm -rf ${REPO-ROOT}/src/platforms/ios/ApproovServiceNative.xcframework`
- Create the `.xcframework` by executing `xcodebuild -create-xcframework -framework Release-iphoneos/ApproovServiceNative.framework -framework Release-iphonesimulator/ApproovServiceNative.framework -output ${REPO-ROOT}/src/platforms/ios/ApproovServiceNative.xcframework`

## Typings
If a change is made to the interface of the ApproovServiceNative layer then it is necessary to regenerate the typings, which provides information about the interface to the typescript layer.

Firstly update the functionality and copy the new `.xcframework` into the plugin itself.

Then use the method described here:

https://v7.docs.nativescript.org/plugins/use-native-ios-libraries#generating-typescript-typings

Note that this needs to be run on an app using the plugin, rather than on the plugin itself. So it is necessary to package the plugin for local usage, and then include it in one of the demo app projects.

It is necessary to make sure the build is clean, the typings may not be generated if not:

`ns clean`

You can then build the project as follows:

`TNS_TYPESCRIPT_DECLARATIONS_PATH="$(pwd)/typings" ns build ios`

This has a side effect of generating a `typings/x86_64` folder at the top level which includes the types for the various Objective-C native libraries used, including the `ApproovServiceNative` library. You can copy the typings back into the plugin itself as follows, assuming you are at the top level of the repo and have used `demo-typescript` to generate the typings:

`cp demo-typescript/typings/x86_64/objc\!ApproovServiceNative.d.ts src/platforms/ios/typings`

(note that the `!` in the filename needs to be escaped as shown)

The updated interface can then be called from the typescript layer.
