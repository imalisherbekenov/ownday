import Foundation
import Darwin

func widgetDirectory() throws -> URL {
  guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "__APP_GROUP__") else { throw CocoaError(.fileNoSuchFile) }
  let directory = root.appendingPathComponent("OwndayWidgetV2", isDirectory: true)
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  return directory
}
func withWidgetLock<T>(_ body: (URL) throws -> T) throws -> T {
  let directory = try widgetDirectory()
  let descriptor = open(directory.appendingPathComponent("storage.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
  guard descriptor >= 0 else { throw CocoaError(.fileWriteUnknown) }
  defer { close(descriptor) }
  guard flock(descriptor, LOCK_EX) == 0 else { throw CocoaError(.fileWriteUnknown) }
  defer { flock(descriptor, LOCK_UN) }
  return try body(directory)
}
func widgetPending(_ directory: URL) throws -> [[String: Any]] {
  var remaining = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension == "json" && UUID(uuidString: $0.deletingPathExtension().lastPathComponent) != nil }
    .compactMap { try JSONSerialization.jsonObject(with: Data(contentsOf: $0)) as? [String: Any] }
    .sorted { ($0["createdAt"] as? String ?? "") < ($1["createdAt"] as? String ?? "") }
  var sorted: [[String: Any]] = []
  while !remaining.isEmpty {
    guard let index = remaining.firstIndex(where: { item in
      guard let dependency = (item["change"] as? [String: Any])?["dependsOn"] as? String else { return true }
      return !remaining.contains { ($0["change"] as? [String: Any])?["operationId"] as? String == dependency }
    }) else { break }
    sorted.append(remaining.remove(at: index))
  }
  return sorted + remaining
}
func widgetRoot(_ directory: URL) -> [String: Any] {
  guard let data = try? Data(contentsOf: directory.appendingPathComponent("snapshot.json")), let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
  return value
}
