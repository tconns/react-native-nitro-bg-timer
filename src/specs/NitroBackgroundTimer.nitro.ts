import type { HybridObject } from 'react-native-nitro-modules'

export interface NitroBackgroundTimer extends HybridObject<{
  ios: 'swift'
  android: 'kotlin'
}> {
  schedule(
    id: number,
    delayMs: number,
    kind: string,
    intervalMs: number,
    group: string,
    driftPolicy: string,
    maxRuns: number,
    callback: (id: number) => void
  ): number
  cancel(id: number): void
  pauseGroup(group: string): number
  resumeGroup(group: string): number
  cancelGroup(group: string): number
  listActiveTimerIds(): number[]
  getStatsJson(): string

  /**
   * Wire snapshot of active native tasks (no JS callbacks). For C++ engine only;
   * JS must re-bind work after process relaunch.
   */
  getPersistWireJson(): string

  /**
   * Replaces the native scheduler queue from `getPersistWireJson()` output.
   * Callbacks are not restored; schedule JS work again for returned ids if needed.
   */
  restorePersistWireJson(wireJson: string): void

  setTimeout(
    id: number,
    duration: number,
    callback: (id: number) => void
  ): number
  clearTimeout(id: number): void
  setInterval(
    id: number,
    interval: number,
    callback: (id: number) => void
  ): number
  clearInterval(id: number): void
}
