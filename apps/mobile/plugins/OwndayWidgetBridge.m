#import <React/RCTBridgeModule.h>
@interface RCT_EXTERN_MODULE(OwndayWidgetBridge, NSObject)
RCT_EXTERN_METHOD(readLegacyMutations:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(readPendingMutations:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(commitSnapshot:(NSString *)value acknowledged:(NSString *)acknowledged resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
