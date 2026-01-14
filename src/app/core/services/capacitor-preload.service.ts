import { Injectable } from '@angular/core';
import { Haptics } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

/**
 * Service to preload Capacitor plugins at app startup.
 * This avoids the first-use latency when plugins are loaded lazily.
 */
@Injectable({
  providedIn: 'root'
})
export class CapacitorPreloadService {
  private initialized = false;

  /**
   * Preload all Capacitor plugins used in the app.
   * Call this once at app startup.
   */
  async preload(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Preload in parallel for faster startup
    await Promise.allSettled([
      this.preloadShare(),
      this.preloadHaptics()
    ]);
  }

  private async preloadShare(): Promise<void> {
    try {
      // Just check if Share is available - this initializes the plugin
      await Share.canShare();
    } catch {
      // Plugin not available (web browser)
    }
  }

  private async preloadHaptics(): Promise<void> {
    try {
      // Haptics doesn't have a canUse method, but importing it is enough
      // The import above already loads the module
      void Haptics;
    } catch {
      // Plugin not available
    }
  }
}
