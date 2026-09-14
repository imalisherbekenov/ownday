package __PACKAGE__
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.uimanager.ViewManager
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class OwndayWidgetBridge(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "OwndayWidgetBridge"
  @ReactMethod fun readLegacyMutations(promise: Promise) {
    promise.resolve(reactApplicationContext.getSharedPreferences(PREFS, 0).getString("ownday.widget.pending.v1", null))
  }
  @ReactMethod fun readPendingMutations(promise: Promise) {
    synchronized(WidgetDataLock) {
      promise.resolve(reactApplicationContext.getSharedPreferences(PREFS, 0).getString(PENDING_KEY, "[]") ?: "[]")
    }
  }
  @ReactMethod fun commitSnapshot(value: String, acknowledged: String, promise: Promise) {
    try {
      synchronized(WidgetDataLock) {
        val prefs = reactApplicationContext.getSharedPreferences(PREFS, 0)
        val ids = JSONArray(acknowledged)
        val accepted = (0 until ids.length()).map { ids.getString(it) }.toSet()
        val previous = JSONArray(prefs.getString(PENDING_KEY, "[]"))
        val pending = JSONArray()
        for(index in 0 until previous.length()) {
          val item = previous.getJSONObject(index)
          if(!accepted.contains(item.getJSONObject("change").getString("operationId"))) pending.put(item)
        }
        check(JSONObject(value).getInt("version") == 2)
        check(prefs.edit().putString(SNAPSHOT_KEY, value).putString(PENDING_KEY, pending.toString()).commit())
      }
      CoroutineScope(Dispatchers.IO).launch { runCatching { OwndayWidget().updateAll(reactApplicationContext) } }
      promise.resolve(null)
    } catch(error: Exception) { promise.reject("WIDGET_STORAGE", error) }
  }
}
class OwndayWidgetPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(OwndayWidgetBridge(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
