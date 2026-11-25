package com.gigswipe.app.device

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.gigswipe.app.MainActivity
import com.gigswipe.app.R
import org.json.JSONArray

/**
 * Local "your gig starts soon" reminders.
 *
 * The app sends the full list whenever it changes; we cancel the old alarms and
 * set the new ones. The list is also saved so [ReminderReceiver] can restore
 * the alarms after a reboot or an app update (Android clears alarms then).
 * Inexact alarms are used on purpose: they need no special permission and
 * a minute or two of drift doesn't matter for a 1-hour heads-up.
 */
object ReminderScheduler {
  const val CHANNEL_ID = "gig_reminders"
  const val ACTION_FIRE = "com.gigswipe.app.REMINDER"
  const val EXTRA_ID = "id"
  const val EXTRA_TITLE = "title"
  const val EXTRA_BODY = "body"
  private const val STORE = "gigswipe_reminders"
  private const val KEY_LIST = "list"
  private const val MAX_REMINDERS = 64

  fun replaceAll(context: Context, json: String) {
    val store = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
    val old = parse(store.getString(KEY_LIST, "[]"))
    for (i in 0 until old.length()) cancel(context, old.getJSONObject(i).optString("id"))

    val kept = scheduleList(context, parse(json))
    store.edit().putString(KEY_LIST, kept.toString()).apply()
  }

  /** After boot / app update: set the saved alarms again (dropping ones in the past). */
  fun restore(context: Context) {
    val store = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
    val kept = scheduleList(context, parse(store.getString(KEY_LIST, "[]")))
    store.edit().putString(KEY_LIST, kept.toString()).apply()
  }

  /** Removes a fired reminder from the saved list. */
  fun forget(context: Context, id: String) {
    val store = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
    val list = parse(store.getString(KEY_LIST, "[]"))
    val kept = JSONArray()
    for (i in 0 until list.length()) {
      val item = list.getJSONObject(i)
      if (item.optString("id") != id) kept.put(item)
    }
    store.edit().putString(KEY_LIST, kept.toString()).apply()
  }

  fun show(context: Context, id: String, title: String, body: String) {
    ensureChannel(context)
    val launch = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val contentIntent = PendingIntent.getActivity(
      context, id.hashCode(), launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_gigswipe)
      .setColor(0xFFFF5864.toInt())
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setContentIntent(contentIntent)
      .setAutoCancel(true)
      .build()
    val manager = NotificationManagerCompat.from(context)
    if (manager.areNotificationsEnabled()) {
      try {
        manager.notify(id.hashCode(), notification)
      } catch (_: SecurityException) {
        // Notification permission was revoked between the check and the call
      }
    }
  }

  private fun scheduleList(context: Context, list: JSONArray): JSONArray {
    val now = System.currentTimeMillis()
    val kept = JSONArray()
    for (i in 0 until list.length()) {
      if (kept.length() >= MAX_REMINDERS) break
      val item = list.optJSONObject(i) ?: continue
      val id = item.optString("id")
      val at = item.optDouble("at", 0.0).toLong()
      if (id.isEmpty() || at <= now) continue
      schedule(context, id, at, item.optString("title"), item.optString("body"))
      kept.put(item)
    }
    return kept
  }

  private fun schedule(context: Context, id: String, at: Long, title: String, body: String) {
    val alarm = context.getSystemService(AlarmManager::class.java) ?: return
    val pending = PendingIntent.getBroadcast(
      context, id.hashCode(), fireIntent(context, id).putExtra(EXTRA_TITLE, title).putExtra(EXTRA_BODY, body),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
  }

  private fun cancel(context: Context, id: String) {
    if (id.isEmpty()) return
    val alarm = context.getSystemService(AlarmManager::class.java) ?: return
    val pending = PendingIntent.getBroadcast(
      context, id.hashCode(), fireIntent(context, id),
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
    ) ?: return
    alarm.cancel(pending)
    pending.cancel()
  }

  // The action includes the id so every reminder gets its own PendingIntent
  // (extras are ignored when Android compares intents).
  private fun fireIntent(context: Context, id: String) =
    Intent(context, ReminderReceiver::class.java)
      .setAction("$ACTION_FIRE.$id")
      .putExtra(EXTRA_ID, id)

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Gig reminders", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Heads-up before a gig you're booked for starts"
      }
    )
  }

  private fun parse(json: String?): JSONArray =
    try { JSONArray(json ?: "[]") } catch (_: Exception) { JSONArray() }
}
