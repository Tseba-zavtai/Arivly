package mn.tureestei.playupdate

import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PlayUpdateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TureeslyPlayUpdate")

    AsyncFunction("availableVersionCode") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(null)
      } else {
        AppUpdateManagerFactory.create(context).appUpdateInfo
          .addOnCompleteListener { task ->
            val update = if (task.isSuccessful) task.result else null
            val version = update
              ?.takeIf { it.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE }
              ?.availableVersionCode()
            promise.resolve(version)
          }
      }
    }
  }
}
