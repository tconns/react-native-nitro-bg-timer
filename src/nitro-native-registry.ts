import type { NitroBackgroundTimer as NitroBackgroundTimerSpec } from './specs/NitroBackgroundTimer.nitro'

export type NativeTimerLike = Pick<
  NitroBackgroundTimerSpec,
  | 'schedule'
  | 'cancel'
  | 'pauseGroup'
  | 'resumeGroup'
  | 'cancelGroup'
  | 'listActiveTimerIds'
  | 'getStatsJson'
  | 'getPersistWireJson'
  | 'restorePersistWireJson'
  | 'setTimeout'
  | 'clearTimeout'
  | 'setInterval'
  | 'clearInterval'
>

let injectedHybrid: NativeTimerLike | null = null
let materializedHybrid: NativeTimerLike | null = null
let hybridFactory: (() => NativeTimerLike) | null = null

export function configureNitroHybridFactory(
  factory: () => NativeTimerLike
): void {
  hybridFactory = factory
}

export function setNitroBackgroundTimerForTests(timer: NativeTimerLike): void {
  injectedHybrid = timer
}

export function resolveNativeHybrid(): NativeTimerLike {
  if (injectedHybrid != null) {
    return injectedHybrid
  }
  if (hybridFactory == null) {
    throw new Error(
      'Nitro hybrid factory missing — import bootstrap before resolving timers'
    )
  }
  return (materializedHybrid ??= hybridFactory())
}
