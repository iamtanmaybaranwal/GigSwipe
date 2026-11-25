// Spec for GigSwipe's own native module (android/app/src/main/java/com/gigswipe/app/device).
// React Native codegen turns this file into the Kotlin base class, so keep the
// file name and the module name ('NativeGigSwipe') in sync with GigSwipeModule.kt.
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** Small persistent settings (language, reminder toggle). Returns '' when unset. Synchronous. */
  getPref(key: string): string;
  setPref(key: string, value: string): void;
  /**
   * Replaces every scheduled gig reminder with this JSON list:
   * [{ id: string, at: number (ms since epoch), title: string, body: string }]
   * Reminders survive reboots and app updates.
   */
  setReminders(json: string): void;
  /** Firebase Cloud Messaging token for this device, or '' if push isn't configured. */
  getPushToken(): Promise<string>;
  /** Gig id from a tapped "new gig" notification (returned once), or ''. Synchronous. */
  consumePendingGigId(): string;
}

export default TurboModuleRegistry.get<Spec>('NativeGigSwipe');
