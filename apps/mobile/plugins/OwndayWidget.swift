import AppIntents
import SwiftUI
import WidgetKit
private struct Habit: Identifiable {
  let id: String; let title: String; var done: Bool; var value: Double; let target: Double?
  var revision: Int; var dependsOn: String?
}
private struct Snapshot {
  let profile: String; let localDate: String; let ru: Bool; var habits: [Habit]
}
private func calendar(_ root: [String: Any]) -> Calendar {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = TimeZone(identifier: root["timezone"] as? String ?? "UTC") ?? TimeZone(secondsFromGMT: 0)!
  return calendar
}
private func readSnapshot(_ directory: URL, at: Date = Date()) throws -> Snapshot {
  let root = widgetRoot(directory), calendar = calendar(root)
  let logical = calendar.component(.hour, from: at) < (root["dayStartHour"] as? Int ?? 4) ? calendar.date(byAdding: .day, value: -1, to: at)! : at
  let parts = calendar.dateComponents([.year, .month, .day], from: logical)
  let date = String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
  let days = root["days"] as? [[String: Any]] ?? []
  let day = days.first { $0["localDate"] as? String == date }
  var habits = (day?["habits"] as? [[String: Any]] ?? []).compactMap { item -> Habit? in
    guard let id = item["id"] as? String, let title = item["title"] as? String else { return nil }
    return Habit(id: id, title: title, done: item["done"] as? Bool ?? false, value: item["value"] as? Double ?? 0, target: item["target"] as? Double, revision: item["revision"] as? Int ?? 0, dependsOn: item["dependsOn"] as? String)
  }
  let profile = root["profileId"] as? String ?? ""
  let acknowledged = Set(root["acknowledgedOperationIds"] as? [String] ?? [])
  for queued in try widgetPending(directory) {
    guard queued["profileId"] as? String == profile, let change = queued["change"] as? [String: Any], change["localDate"] as? String == date,
      let id = change["operationId"] as? String, !acknowledged.contains(id), let index = habits.firstIndex(where: { $0.id == (change["habitId"] as? String) }), let action = change["action"] as? [String: Any] else { continue }
    habits[index].done = action["kind"] as? String != "clear"
    habits[index].value = habits[index].done ? (action["value"] as? Double ?? habits[index].target ?? 1) : 0
    habits[index].revision += 1
    habits[index].dependsOn = id
  }
  return Snapshot(profile: profile, localDate: date, ru: root["locale"] as? String != "en", habits: habits)
}
struct ToggleHabitIntent: AppIntent {
  static var title: LocalizedStringResource = "Mark habit"
  static var openAppWhenRun = false
  @Parameter(title: "Habit") var habitId: String
  @Parameter(title: "Profile") var profileId: String
  @Parameter(title: "Date") var localDate: String
  init() {}
  init(habitId: String, profileId: String, localDate: String) { self.habitId = habitId; self.profileId = profileId; self.localDate = localDate }
  func perform() async throws -> some IntentResult {
    try withWidgetLock { directory in
      let snapshot = try readSnapshot(directory)
      guard snapshot.profile == profileId, snapshot.localDate == localDate, let habit = snapshot.habits.first(where: { $0.id == habitId }) else { return }
      let id = UUID().uuidString.lowercased()
      let action: [String: Any] = habit.done ? ["kind": "clear"] : ["kind": "set", "status": "done", "value": habit.target ?? 1]
      var change: [String: Any] = ["operationId": id, "habitId": habitId, "localDate": localDate, "baseRevision": habit.revision, "action": action]
      if let dependency = habit.dependsOn { change["dependsOn"] = dependency }
      let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      let queued: [String: Any] = ["profileId": profileId, "change": change, "createdAt": formatter.string(from: Date())]
      try JSONSerialization.data(withJSONObject: queued).write(to: directory.appendingPathComponent(id + ".json"), options: .atomic)
    }
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}
private struct Entry: TimelineEntry { let date: Date; let snapshot: Snapshot }
private struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry { Entry(date: Date(), snapshot: Snapshot(profile: "", localDate: "", ru: true, habits: [])) }
  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion((try? withWidgetLock { Entry(date: Date(), snapshot: try readSnapshot($0)) }) ?? placeholder(in: context))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let entries = try? withWidgetLock { directory -> [Entry] in
      let root = widgetRoot(directory), calendar = calendar(root)
      var date = Date(), entries = [Entry(date: date, snapshot: try readSnapshot(directory, at: date))]
      for _ in 0..<32 {
        guard let next = calendar.nextDate(after: date, matching: DateComponents(hour: root["dayStartHour"] as? Int ?? 4, minute: 0), matchingPolicy: .nextTime, repeatedTimePolicy: .first) else { break }
        date = next
        entries.append(Entry(date: date, snapshot: try readSnapshot(directory, at: date)))
      }
      return entries
    }
    completion(Timeline(entries: entries ?? [placeholder(in: context)], policy: .atEnd))
  }
}
private func color(_ light: UInt, _ dark: UInt, scheme: ColorScheme) -> Color {
  let raw = scheme == .dark ? dark : light
  return Color(red: Double((raw >> 16) & 255) / 255, green: Double((raw >> 8) & 255) / 255, blue: Double(raw & 255) / 255)
}
private struct OwndayView: View {
  @Environment(\.colorScheme) private var scheme
  @Environment(\.widgetFamily) private var family
  let entry: Entry
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(entry.snapshot.ru ? "Твой день" : "Your day").font(.headline).foregroundStyle(color(__LIGHT_INK__, __DARK_INK__, scheme: scheme))
      if entry.snapshot.habits.isEmpty { Text(entry.snapshot.ru ? "Открой Ownday" : "Open Ownday").font(.caption) }
      ForEach(entry.snapshot.habits.prefix(family == .systemSmall ? 3 : 4)) { habit in
        Button(intent: ToggleHabitIntent(habitId: habit.id, profileId: entry.snapshot.profile, localDate: entry.snapshot.localDate)) {
          HStack(spacing: 8) {
            Image(systemName: habit.done ? "checkmark.circle.fill" : "circle").foregroundStyle(habit.done ? color(__LIGHT_DONE__, __DARK_DONE__, scheme: scheme) : color(__LIGHT_NEUTRAL__, __DARK_NEUTRAL__, scheme: scheme))
            Text(habit.title).font(.caption).lineLimit(1)
            Spacer(minLength: 0)
            if let target = habit.target { Text("\(habit.value.formatted())/\(target.formatted())").font(.caption.monospacedDigit()) }
          }.frame(minHeight: 28).foregroundStyle(color(__LIGHT_INK__, __DARK_INK__, scheme: scheme))
        }.buttonStyle(.plain).accessibilityLabel((habit.done ? (entry.snapshot.ru ? "Отменить: " : "Undo: ") : (entry.snapshot.ru ? "Выполнить: " : "Complete: ")) + habit.title)
      }
    }
    .widgetURL(URL(string: "ownday://"))
    .containerBackground(color(__LIGHT_SURFACE__, __DARK_SURFACE__, scheme: scheme), for: .widget)
  }
}
@main struct OwndayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OwndayWidget", provider: Provider()) { OwndayView(entry: $0) }
      .configurationDisplayName("Ownday").description("Your daily habits / Привычки на сегодня")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}
