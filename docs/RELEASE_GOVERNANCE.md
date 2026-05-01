# Release Governance

## Compatibility contract

- Nitro spec changes must be backward-compatible within a minor version.
- Persist wire changes must keep `version` explicit and provide migration behavior.
- New optional fields must have safe defaults on both Android and iOS.

## Deprecation policy

- Mark deprecated fields/APIs in docs one minor release before removal.
- Keep runtime fallback for at least one minor release cycle.

## Release channels

- `alpha`: experimental semantics and policy changes
- `beta`: feature-complete candidate with reliability metrics
- `stable`: all required gates green and docs synchronized

## Required gates before stable

- `npm run verify:release` green
- nightly runtime workflow green for 3 consecutive runs
- reliability scorecard trend non-regressing for last 3 builds
- feature status rows updated (`done`/`blocked` with reason)
