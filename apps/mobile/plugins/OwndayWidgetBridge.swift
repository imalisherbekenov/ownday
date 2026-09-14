import Foundation
import React
import WidgetKit
@objc(OwndayWidgetBridge)
final class OwndayWidgetBridge: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }
  @objc func readLegacyMutations(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let defaults = UserDefaults(suiteName: "__APP_GROUP__")
    let raw = defaults?.data(forKey: "ownday.widget.pending.v1").flatMap { String(data: $0, encoding: .utf8) } ?? defaults?.string(forKey: "ownday.widget.pending.v1")
    resolve(raw)
  }
  @objc func readPendingMutations(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      let data = try withWidgetLock { try JSONSerialization.data(withJSONObject: widgetPending($0)) }
      resolve(String(data: data, encoding: .utf8) ?? "[]")
    } catch { reject("WIDGET_STORAGE", "Could not read widget actions", error) }
  }
  @objc func commitSnapshot(_ value: String, acknowledged: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      guard let data = value.data(using: .utf8), var snapshot = try JSONSerialization.jsonObject(with: data) as? [String: Any], snapshot["version"] as? Int == 2,
        let idsData = acknowledged.data(using: .utf8), let ids = try JSONSerialization.jsonObject(with: idsData) as? [String] else { throw CocoaError(.fileReadCorruptFile) }
      try withWidgetLock { directory in
        snapshot["acknowledgedOperationIds"] = ids
        try JSONSerialization.data(withJSONObject: snapshot).write(to: directory.appendingPathComponent("snapshot.json"), options: .atomic)
        for id in ids where UUID(uuidString: id) != nil {
          let file = directory.appendingPathComponent(id.lowercased() + ".json")
          if FileManager.default.fileExists(atPath: file.path) { try FileManager.default.removeItem(at: file) }
        }
      }
      WidgetCenter.shared.reloadAllTimelines()
      resolve(nil)
    } catch { reject("WIDGET_STORAGE", "Could not commit widget snapshot", error) }
  }
}
