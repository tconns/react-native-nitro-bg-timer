# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Updated `moduleResolution` to `Bundler` in tsconfig.json
- Upgraded Yarn to modern version with `nodeLinker: node-modules`

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
