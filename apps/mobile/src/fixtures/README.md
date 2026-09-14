`expo-single-target.pbxproj` is the generated single-target Xcode project from the MIT-licensed Expo bare minimum template, retrieved on 2026-09-14:

https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/ios/HelloWorld.xcodeproj/project.pbxproj

It reproduces the missing `Plugins`, `PBXTargetDependency` and `PBXContainerItemProxy` sections of the real EAS prebuild input. Tests parse the configuration; they do not execute its build scripts.
