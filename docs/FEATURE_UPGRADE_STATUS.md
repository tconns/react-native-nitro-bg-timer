# Feature Upgrade Status

> Single source of truth for feature state and release readiness.

Last updated for: **1.x stabilization track**

## Legend

- ✅ `done`
- 🚧 `in_progress`
- 🗓️ `planned`
- ⛔ `blocked`
- ➖ `n/a`

## Snapshot

| Area | Done | In Progress | Planned | Blocked |
| --- | ---: | ---: | ---: | ---: |
| Core Runtime | 5 | 0 | 0 | 0 |
| Performance & Reliability | 5 | 1 | 0 | 0 |
| Feature Semantics | 4 | 1 | 0 | 0 |
| Release Gates | 4 | 0 | 0 | 0 |

---

## 1) Core Runtime

| Feature | Status | JS | Android | iOS | C++ Core | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Scheduler API (`schedule`, group controls) | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done | Mainline API path for 1.x |
| Typed schedule bridge payload | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done | Persist wire intentionally stays JSON |
| Shared C++ queue scheduler foundation | ✅ done | ➖ n/a | ✅ done | ✅ done | ✅ done | `SchedulerCore` wired through native adapters |
| Legacy timer API compatibility (`setTimeout`, `setInterval`) | ✅ done | ✅ done | ✅ done | ✅ done | ➖ n/a | Maintained for migration safety |
| Persist wire export/restore hooks | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done | Schema-guarded restore is active |

---

## 2) Performance & Reliability

| Feature | Status | JS | Android | iOS | C++ Core | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Scheduler stats (`active`, `callback`, `missed`, `wakeup`) | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done | Available via `getStats()` |
| Lateness telemetry (`late`, `avg`, `p95`) | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done | Tracked and surfaced |
| JS callback/memory hardening | ✅ done | ✅ done | ➖ n/a | ➖ n/a | ➖ n/a | Advanced callback cleanup + retry wrapper consistency |
| Native metadata hot-path optimization | ✅ done | ➖ n/a | ✅ done | ✅ done | ✅ done | Removed redundant normalize passes in schedule path |
| Stress + smoke benchmark lanes | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done | Node, bridge, native core, smoke, soak |
| Reliability scorecard automation trend in CI | 🚧 in_progress | 🚧 in_progress | 🗓️ planned | 🗓️ planned | 🗓️ planned | Scorecard exists; automate 3-build trend artifact |

---

## 3) Feature Semantics

| Feature | Status | JS | Android | iOS | C++ Core | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Retry/backoff fields transport and behavior | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done | JS retry behavior + profile clamping active |
| Cancellation token transport | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done | Forwarded and normalized |
| Tags + policy profile transport | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done | Forwarded across layers |
| Policy profiles (`batterySaver`/`balanced`/`latencyFirst`) | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done | Enforced in adapter behavior |
| Production observability event contract | 🚧 in_progress | ✅ done | 🗓️ planned | 🗓️ planned | 🗓️ planned | JS emitter is complete; native parity pending |

---

## 4) Release Gates

| Gate | Status | Notes |
| --- | --- | --- |
| `npm run verify:release` | ✅ done | Mandatory pre-publish gate |
| Nightly native bench workflow | ✅ done | Runtime smoke + stress lanes are tracked |
| Docs synchronized with implementation | ✅ done | Status/governance/migration docs are aligned for current release candidate |
| Governance policy published | ✅ done | See `docs/RELEASE_GOVERNANCE.md` |

---

## 5) Next Milestones

| Milestone | Target State |
| --- | --- |
| Add automated 3-build reliability scorecard trend artifact in CI | 🚧 in_progress |
| Add native emitter parity for observability contract fields/reason codes | 🗓️ planned |
| Track monthly benchmark trend snapshots in release notes | 🗓️ planned |
