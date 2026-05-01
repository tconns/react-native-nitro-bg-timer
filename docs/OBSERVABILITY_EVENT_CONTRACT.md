# Observability Event Contract

This document defines a stable telemetry contract for host applications.

## Event names

- `scheduled`
- `fired`
- `missed`
- `retry`
- `cancelled`
- `expired`
- `restored`

Current implementation status:

- JS emitter: `scheduled`, `fired`, `cancelled`, `restored`, `expired`, `retry`, `missed`
- Native emitter parity: in progress

## Common fields

- `timerId` (number)
- `kind` (`timeout` | `interval`)
- `group` (string)
- `policyProfile` (string)
- `timestampMs` (number)
- `driftMs` (number, optional)
- `attempt` (number, optional)
- `reason` (string, optional)

## Reason codes (initial)

- `handle_cancel`
- `clearTimeout`
- `clearInterval`
- `cancelGroup`
- `manual_restore`
- `restore_rejected_invalid_json`
- `restore_rejected_unsupported_version`
- `restore_rejected_tasks_not_array`
- `callback_error`
- `metadata_quota_exceeded`

## Metadata safety constraints

- `metadataJson` max bytes: `4096`
- Unknown top-level keys are dropped.
- Invalid UTF-8/control chars are normalized to spaces.
- Oversized metadata emits `cancelled` or `missed` with reason `metadata_quota_exceeded` (host-configurable policy).

## Wire compatibility

- Persist wire is versioned (`version` field).
- New metadata keys must be optional and backward-compatible.
- Migration tests must validate:
  - old wire -> new runtime
  - new wire (without optional fields) -> old behavior fallback

## Recommended host export

Host apps should map module events into their telemetry pipeline (Datadog/Sentry/OTel) with consistent tags:

- `platform`
- `appVersion`
- `moduleVersion`
- `deviceClass`
