import AppIntents
import SwiftUI
import WidgetKit

private let appGroup = "__APP_GROUP__"
private let snapshotKey = "__SNAPSHOT_KEY__"
private let pendingKey = "__PENDING_KEY__"

private struct Habit: Codable, Identifiable {
  let id: String
  let title: String
  var done: Bool
  let value: Int
  let target: Int?
  let streak: Int
}

private struct Snapshot: Codable {
  let version: Int
  let localDate: String
  var habits: [Habit]
}

private struct Mutation: Codable {
  let clientId: String
  let habitId: String
  let localDate: String
  let status: String
}

private func defaults() -> UserDefaults { UserDefaults(suiteName: appGroup)! }

private func readSnapshot() -> Snapshot {
  guard let raw = defaults().string(forKey: snapshotKey), let data = raw.data(using: .utf8),
    let value = try? JSONDecoder().decode(Snapshot.self, from: data) else {
    return Snapshot(version: 1, localDate: "", habits: [])
  }
  return value
}

private func color(_ light: UInt, _ dark: UInt, scheme: ColorScheme) -> Color {
  let raw = scheme == .dark ? dark : light
  return Color(red: Double((raw >> 16) & 255) / 255, green: Double((raw >> 8) & 255) / 255, blue: Double(raw & 255) / 255)
}

struct ToggleHabitIntent: AppIntent {
  static var title: LocalizedStringResource = "Mark habit"
  static var openAppWhenRun = false
  @Parameter(title: "Habit") var habitId: String

  init() {}
  init(habitId: String) { self.habitId = habitId }

  func perform() async throws -> some IntentResult {
    var snapshot = readSnapshot()
    guard let index = snapshot.habits.firstIndex(where: { $0.id == habitId }) else { return .result() }
    snapshot.habits[index].done.toggle()
    let status = snapshot.habits[index].done ? "done" : "miss"
    let mutation = Mutation(clientId: "mobile:\(habitId):\(snapshot.localDate)", habitId: habitId, localDate: snapshot.localDate, status: status)
    var pending = (defaults().data(forKey: pendingKey).flatMap { try? JSONDecoder().decode([Mutation].self, from: $0) }) ?? []
    pending.removeAll { $0.clientId == mutation.clientId }
    pending.append(mutation)
    defaults().set(try JSONEncoder().encode(pending), forKey: pendingKey)
    defaults().set(String(data: try JSONEncoder().encode(snapshot), encoding: .utf8), forKey: snapshotKey)
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}

private struct Entry: TimelineEntry { let date: Date; let snapshot: Snapshot }
private struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry { Entry(date: Date(), snapshot: readSnapshot()) }
  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(placeholder(in: context)) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    completion(Timeline(entries: [placeholder(in: context)], policy: .never))
  }
}

private struct OwndayView: View {
  @Environment(\.colorScheme) private var scheme
  @Environment(\.widgetFamily) private var family
  let entry: Entry

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("\(entry.snapshot.habits.map(\.streak).max() ?? 0)")
        .font(.system(size: 32, weight: .heavy, design: .monospaced))
        .foregroundStyle(color(__LIGHT_STREAK__, __DARK_STREAK__, scheme: scheme))
      ForEach(entry.snapshot.habits.prefix(family == .systemSmall ? 3 : 4)) { habit in
        if family == .systemMedium {
          Button(intent: ToggleHabitIntent(habitId: habit.id)) { row(habit) }.buttonStyle(.plain)
        } else { row(habit) }
      }
    }
    .containerBackground(color(__LIGHT_SURFACE__, __DARK_SURFACE__, scheme: scheme), for: .widget)
  }

  private func row(_ habit: Habit) -> some View {
    HStack(spacing: 8) {
      Text(habit.done ? "✓" : "○").foregroundStyle(habit.done ? color(__LIGHT_DONE__, __DARK_DONE__, scheme: scheme) : color(__LIGHT_NEUTRAL__, __DARK_NEUTRAL__, scheme: scheme))
      Text(habit.title).font(.caption).lineLimit(1).foregroundStyle(habit.done ? color(__LIGHT_NEUTRAL__, __DARK_NEUTRAL__, scheme: scheme) : color(__LIGHT_INK__, __DARK_INK__, scheme: scheme))
      Spacer()
      if let target = habit.target { Text("\(habit.value)/\(target)").font(.caption.monospacedDigit()).foregroundStyle(color(__LIGHT_NEUTRAL__, __DARK_NEUTRAL__, scheme: scheme)) }
    }.frame(minHeight: 28)
  }
}

@main struct OwndayWidgetBundle: WidgetBundle {
  var body: some Widget {
    StaticConfiguration(kind: "OwndayWidget", provider: Provider()) { OwndayView(entry: $0) }
      .configurationDisplayName("Ownday")
      .description("Today's habits and streaks")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}
