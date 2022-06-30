# Approov Service Native

NativeScript does not allow native code source files to be compiled as part of the plugin installation process. They must be pre-compiled.

This folder provides the source code for the native code parts of the plugin for both Android and iOS. These are manually pre-compiled into libraries and then dropped into the relevant platforms directory in the plugin itself. They are provided as Android Studio and Xcode projects.

The native code layer provides an interface between a typescript based wrapper, that is exposed to the user, and the Approov SDK itself. The typescript only calls this `ApproovServiceNative` layer, not the SDK directly. It is implemented this way because we wish to largerly implement the quickstart in native code, in common with the other quickstarts, and also because we wish to hook the platform layers using either swizzling (iOS) or reflection (Android) annd this is only possible using native code.
