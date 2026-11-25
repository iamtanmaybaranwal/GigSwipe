package com.gigswipe.app.device

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.gigswipe.app.specs.NativeGigSwipeSpec

/** Settings storage + gig reminders. JS side: src/specs/NativeGigSwipe.ts */
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

  companion object {
    const val NAME = "NativeGigSwipe"
    private const val PREFS = "gigswipe_settings"
  }
}
