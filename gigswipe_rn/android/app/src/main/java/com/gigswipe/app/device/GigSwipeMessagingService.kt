package com.gigswipe.app.device

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
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Receives push messages from the GigSwipe server (Firebase Cloud Messaging).
 * The server sends data-only messages, so this runs even when the app is in
 * the background or closed, and we decide how the notification looks.
 */
class GigSwipeMessagingService : FirebaseMessagingService() {

  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    val title = data["title"] ?: return
    val body = data["body"] ?: ""
    val gigId = data["gigId"]
    val tag = data["tag"]?.takeIf { it.isNotEmpty() } ?: (gigId ?: title)
    show(applicationContext, tag, title, body, gigId)
  }

  /** Firebase rotated this device's token: the app re-registers it on next start. */
  override fun onNewToken(token: String) {
    applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit().putString(KEY_TOKEN_CHANGED, "1").apply()
  }

  companion object {
    const val CHANNEL_ID = "gig_alerts"
    const val EXTRA_GIG_ID = "gigswipe_gig_id"
    const val PREFS = "gigswipe_settings"
    const val KEY_PENDING_GIG = "pending_gig"
    const val KEY_TOKEN_CHANGED = "push_token_changed"

    fun show(context: Context, tag: String, title: String, body: String, gigId: String?) {
      ensureChannel(context)
      val open = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        if (gigId != null) putExtra(EXTRA_GIG_ID, gigId)
      }
      val pending = PendingIntent.getActivity(
        context, tag.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      val n = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_gigswipe)
        .setColor(0xFFFF5864.toInt())
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
        .setContentIntent(pending)
        .setAutoCancel(true)
        .build()
      val manager = NotificationManagerCompat.from(context)
      if (!manager.areNotificationsEnabled()) return
      try {
        manager.notify(tag, 1, n)
      } catch (_: SecurityException) {
        // permission revoked
      }
    }

    private fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(NotificationManager::class.java) ?: return
      if (manager.getNotificationChannel(CHANNEL_ID) != null) return
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "New gigs near you", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "When a gig is posted inside your working range"
        }
      )
    }

    /** Remembers which gig a tapped notification was about, for the app to open. */
    fun rememberLaunchIntent(context: Context, intent: Intent?) {
      val gigId = intent?.getStringExtra(EXTRA_GIG_ID) ?: return
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_PENDING_GIG, gigId).apply()
      intent.removeExtra(EXTRA_GIG_ID)
    }
  }
}
