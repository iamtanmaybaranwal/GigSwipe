package com.gigswipe.app.device

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.gigswipe.app.specs.NativeGigSwipeSpec
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging

/** Settings storage, gig reminders and push tokens. JS side: src/specs/NativeGigSwipe.ts */
class GigSwipeModule(context: ReactApplicationContext) : NativeGigSwipeSpec(context) {

  private val prefs
    get() = reactApplicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  override fun getName() = NAME

  override fun getPref(key: String): String = prefs.getString(key, "") ?: ""

  override fun setPref(key: String, value: String) {
    prefs.edit().putString(key, value).apply()
  }

  override fun setReminders(json: String) {
    ReminderScheduler.replaceAll(reactApplicationContext, json)
  }

  /** This device's Firebase push token, or "" when push isn't set up in this build. */
  override fun getPushToken(promise: Promise) {
    try {
      if (FirebaseApp.getApps(reactApplicationContext).isEmpty()) {
        promise.resolve("")
        return
      }
      FirebaseMessaging.getInstance().token
        .addOnSuccessListener { token ->
          prefs.edit().remove(GigSwipeMessagingService.KEY_TOKEN_CHANGED).apply()
          promise.resolve(token ?: "")
        }
        .addOnFailureListener { promise.resolve("") }
    } catch (_: Throwable) {
      promise.resolve("")
    }
  }

  /** The gig whose notification opened the app (once), or "". */
  override fun consumePendingGigId(): String {
    val id = prefs.getString(GigSwipeMessagingService.KEY_PENDING_GIG, "") ?: ""
    if (id.isNotEmpty()) prefs.edit().remove(GigSwipeMessagingService.KEY_PENDING_GIG).apply()
    return id
  }

  companion object {
    const val NAME = "NativeGigSwipe"
    private const val PREFS = "gigswipe_settings"
  }
}
