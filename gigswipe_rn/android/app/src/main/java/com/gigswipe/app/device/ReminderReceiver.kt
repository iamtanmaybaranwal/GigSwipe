package com.gigswipe.app.device

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Shows a reminder when its alarm fires, and restores alarms after reboot / app update. */
class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    when {
      action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED ->
        ReminderScheduler.restore(context)

      action.startsWith(ReminderScheduler.ACTION_FIRE) -> {
        val id = intent.getStringExtra(ReminderScheduler.EXTRA_ID) ?: return
        ReminderScheduler.show(
          context,
          id,
          intent.getStringExtra(ReminderScheduler.EXTRA_TITLE) ?: "GigSwipe",
          intent.getStringExtra(ReminderScheduler.EXTRA_BODY) ?: "",
        )
        ReminderScheduler.forget(context, id)
      }
    }
  }
}
