import type { NitroBackgroundTimer as NitroBackgroundTimerSpec } from './specs/NitroBackgroundTimer.nitro'
import { NitroModules } from 'react-native-nitro-modules'

import { configureNitroHybridFactory } from './nitro-native-registry'

configureNitroHybridFactory(() =>
  NitroModules.createHybridObject<NitroBackgroundTimerSpec>(
    'NitroBackgroundTimer'
  )
)
