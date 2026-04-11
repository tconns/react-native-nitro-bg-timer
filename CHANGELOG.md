# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Example app with 7 test sections (SetTimeout, SetInterval, Background, Concurrent, Cleanup, Hook, Stress)
- `useBackgroundTimer` custom hook in example app

### Changed

- Upgraded Nitro Modules from 0.29.3 to 0.35.0
- Upgraded React Native to 0.84.1
- Updated `moduleResolution` to `Bundler` in tsconfig.json
- Upgraded Yarn to modern version with `nodeLinker: node-modules`
- Updated Podfile.lock with `react-native-safe-area-context`

### Fixed

- Fixed iOS timer race condition (main-thread dispatch, same-ID timer overwrites)
- Fixed HookTest render error in example app
- Fixed native bugs surfaced during React Native 0.84.1 upgrade

### Security

- Bumped `lodash` dependency
- Bumped `lodash-es` dependency
- Bumped `handlebars` dependency

## [0.1.0] - 2025-09-07

### Changed

- Updated Nitro Modules to 0.29.3

### Docs

- Added support button to README

### Fixed

- Fixed iOS native implementation

## [0.0.1] - 2025-09-02

### Added

- Initial implementation of react-native-nitro-bg-timer
- Background `setTimeout` / `clearTimeout` support
- Background `setInterval` / `clearInterval` support
- iOS native implementation (Swift) using `UIApplication.beginBackgroundTask`
- Android native implementation (Kotlin) using `PowerManager.PARTIAL_WAKE_LOCK`
- Nitro Modules JSI bridge integration for zero-overhead native calls
- TypeScript API wrapper with callback management
- Full API documentation and usage examples in README

[Unreleased]: https://github.com/marcocrupi/react-native-nitro-bg-timer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/marcocrupi/react-native-nitro-bg-timer/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/marcocrupi/react-native-nitro-bg-timer/releases/tag/v0.0.1
