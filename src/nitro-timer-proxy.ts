import type { NitroBackgroundTimer as NitroBackgroundTimerSpec } from './specs/NitroBackgroundTimer.nitro'

import {
  type NativeTimerLike,
  resolveNativeHybrid,
  setNitroBackgroundTimerForTests,
} from './nitro-native-registry'

export type { NativeTimerLike }
export { setNitroBackgroundTimerForTests }

/** Thin façade so benchmarks can import Nitro wrappers without RN bootstrap. */
export const NitroBackgroundTimer = {
  schedule: (...args: Parameters<NitroBackgroundTimerSpec['schedule']>) =>
    resolveNativeHybrid().schedule(...args),
  cancel: (...args: Parameters<NitroBackgroundTimerSpec['cancel']>) =>
    resolveNativeHybrid().cancel(...args),
  pauseGroup: (...args: Parameters<NitroBackgroundTimerSpec['pauseGroup']>) =>
    resolveNativeHybrid().pauseGroup(...args),
  resumeGroup: (...args: Parameters<NitroBackgroundTimerSpec['resumeGroup']>) =>
    resolveNativeHybrid().resumeGroup(...args),
  cancelGroup: (...args: Parameters<NitroBackgroundTimerSpec['cancelGroup']>) =>
    resolveNativeHybrid().cancelGroup(...args),
  listActiveTimerIds: (
    ...args: Parameters<NitroBackgroundTimerSpec['listActiveTimerIds']>
  ) => resolveNativeHybrid().listActiveTimerIds(...args),
  getStatsJson: (
    ...args: Parameters<NitroBackgroundTimerSpec['getStatsJson']>
  ) => resolveNativeHybrid().getStatsJson(...args),
  getPersistWireJson: (
    ...args: Parameters<NitroBackgroundTimerSpec['getPersistWireJson']>
  ) => resolveNativeHybrid().getPersistWireJson(...args),
  restorePersistWireJson: (
    ...args: Parameters<NitroBackgroundTimerSpec['restorePersistWireJson']>
  ) => resolveNativeHybrid().restorePersistWireJson(...args),
  setTimeout: (...args: Parameters<NitroBackgroundTimerSpec['setTimeout']>) =>
    resolveNativeHybrid().setTimeout(...args),
  clearTimeout: (
    ...args: Parameters<NitroBackgroundTimerSpec['clearTimeout']>
  ) => resolveNativeHybrid().clearTimeout(...args),
  setInterval: (...args: Parameters<NitroBackgroundTimerSpec['setInterval']>) =>
    resolveNativeHybrid().setInterval(...args),
  clearInterval: (
    ...args: Parameters<NitroBackgroundTimerSpec['clearInterval']>
  ) => resolveNativeHybrid().clearInterval(...args),
}
