package __PACKAGE__

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.*
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.color.ColorProvider
import org.json.JSONArray
import org.json.JSONObject
import java.time.ZoneId
import java.time.ZonedDateTime

internal object WidgetDataLock
internal const val SNAPSHOT_KEY = "ownday.widget.snapshot.v2"
internal const val PENDING_KEY = "ownday.widget.pending.v2"
internal const val PREFS = "ownday_widget"
private val HabitIdKey = ActionParameters.Key<String>("habitId")
private val ProfileKey = ActionParameters.Key<String>("profileId")
private val DateKey = ActionParameters.Key<String>("localDate")
private data class Habit(val id: String, val title: String, var done: Boolean, var value: Double, val target: Double?, var revision: Int, var dependsOn: String?)
private data class Snapshot(val profile: String, val date: String, val ru: Boolean, val habits: List<Habit>)
private fun snapshot(context: Context): Snapshot {
  val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  return runCatching {
    val root = JSONObject(prefs.getString(SNAPSHOT_KEY, null) ?: return Snapshot("", "", true, emptyList()))
    val now = ZonedDateTime.now(ZoneId.of(root.getString("timezone")))
    val date = (if (now.hour < root.getInt("dayStartHour")) now.toLocalDate().minusDays(1) else now.toLocalDate()).toString()
    val days = root.getJSONArray("days")
    val day = (0 until days.length()).map { days.getJSONObject(it) }.find { it.getString("localDate") == date }
    val values = day?.getJSONArray("habits") ?: JSONArray()
    val habits = (0 until values.length()).map { index ->
      val item = values.getJSONObject(index)
      Habit(item.getString("id"), item.getString("title"), item.optBoolean("done"), item.getDouble("value"), if(item.isNull("target")) null else item.getDouble("target"), item.getInt("revision"), if(item.isNull("dependsOn")) null else item.getString("dependsOn"))
    }
    val pending = JSONArray(prefs.getString(PENDING_KEY, "[]"))
    for (index in 0 until pending.length()) {
      val queued = pending.getJSONObject(index)
      val change = queued.getJSONObject("change")
      if (queued.getString("profileId") != root.getString("profileId") || change.getString("localDate") != date) continue
      val habit = habits.find { it.id == change.getString("habitId") } ?: continue
      val action = change.getJSONObject("action")
      habit.done = action.getString("kind") != "clear"
      habit.value = if (habit.done) action.optDouble("value", habit.target ?: 1.0) else 0.0
      habit.revision += 1
      habit.dependsOn = change.getString("operationId")
    }
    Snapshot(root.getString("profileId"), date, root.getString("locale") == "ru", habits)
  }.getOrDefault(Snapshot("", "", true, emptyList()))
}
private object Palette {
  val surface = ColorProvider(Color(android.graphics.Color.parseColor("__LIGHT_SURFACE__")), Color(android.graphics.Color.parseColor("__DARK_SURFACE__")))
  val ink = ColorProvider(Color(android.graphics.Color.parseColor("__LIGHT_INK__")), Color(android.graphics.Color.parseColor("__DARK_INK__")))
  val neutral = ColorProvider(Color(android.graphics.Color.parseColor("__LIGHT_NEUTRAL__")), Color(android.graphics.Color.parseColor("__DARK_NEUTRAL__")))
  val done = ColorProvider(Color(android.graphics.Color.parseColor("__LIGHT_DONE__")), Color(android.graphics.Color.parseColor("__DARK_DONE__")))
}
private fun number(value: Double) = java.math.BigDecimal.valueOf(value).stripTrailingZeros().toPlainString()
class OwndayWidget : GlanceAppWidget() {
  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val data = synchronized(WidgetDataLock) { snapshot(context) }
    provideContent { WidgetContent(data) }
  }
  @Composable private fun WidgetContent(data: Snapshot) {
    Column(GlanceModifier.fillMaxSize().background(Palette.surface).padding(16.dp)) {
      Text(if(data.ru) "Твой день" else "Your day", style = TextStyle(color = Palette.ink, fontWeight = FontWeight.Bold))
      Spacer(GlanceModifier.height(8.dp))
      if(data.habits.isEmpty()) Text(if(data.ru) "Открой Ownday" else "Open Ownday", style = TextStyle(color = Palette.neutral))
      data.habits.take(4).forEach { habit ->
        Row(GlanceModifier.fillMaxWidth().height(44.dp).clickable(actionRunCallback<ToggleHabitAction>(actionParametersOf(HabitIdKey to habit.id, ProfileKey to data.profile, DateKey to data.date))), verticalAlignment = Alignment.Vertical.CenterVertically) {
          Text(if(habit.done) "✓" else "○", style = TextStyle(color = if(habit.done) Palette.done else Palette.neutral))
          Spacer(GlanceModifier.width(8.dp))
          Text(habit.title, modifier = GlanceModifier.defaultWeight(), style = TextStyle(color = if(habit.done) Palette.neutral else Palette.ink), maxLines = 1)
          if(habit.target != null) Text(" " + number(habit.value) + "/" + number(habit.target), style = TextStyle(color = Palette.neutral))
        }
      }
    }
  }
}
class ToggleHabitAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
    synchronized(WidgetDataLock) {
      val data = snapshot(context)
      // A stale launcher surface must never act on a new account or calendar date.
      if (parameters[ProfileKey] == data.profile && parameters[DateKey] == data.date) {
        val habit = data.habits.find { it.id == parameters[HabitIdKey] }
        if (habit != null) {
          val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
          val pending = JSONArray(prefs.getString(PENDING_KEY, "[]"))
          val action = if (habit.done) JSONObject().put("kind", "clear") else JSONObject().put("kind", "set").put("status", "done").put("value", habit.target ?: 1.0)
          val change = JSONObject().put("operationId", java.util.UUID.randomUUID().toString()).put("habitId", habit.id).put("localDate", data.date).put("baseRevision", habit.revision).put("action", action)
          if (habit.dependsOn != null) change.put("dependsOn", habit.dependsOn)
          pending.put(JSONObject().put("profileId", data.profile).put("change", change).put("createdAt", java.time.Instant.now().toString()))
          check(prefs.edit().putString(PENDING_KEY, pending.toString()).commit()) { "Could not persist widget action" }
        }
      }
    }
    OwndayWidget().update(context, glanceId)
  }
}
class OwndayWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget = OwndayWidget()
}
