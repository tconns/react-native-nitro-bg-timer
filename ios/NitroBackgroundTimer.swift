//
//  NitroBackgroundTimer.swift
//  NitroBackgroundTimer
//

import Foundation
import UIKit
import NitroModules

class NitroBackgroundTimer: HybridNitroBackgroundTimerSpec {
  /// Default matches Android USE_CPP_SCHEDULER=true. Env `NITRO_BG_USE_LEGACY_SW_SCHEDULER=1` restores pure-Swift scheduler.
  private static var useCppEngine: Bool {
    ProcessInfo.processInfo.environment["NITRO_BG_USE_LEGACY_SW_SCHEDULER"]?.isEmpty == false ?
      false : true
  }

  private static let defaultGroup = "default"
  private static let latenessP95RecalcInterval = 16

  private struct ScheduledTask {
    let id: Int
    var nextRunAtMs: Double
    let kind: String
    let intervalMs: Double
    let group: String
    let driftPolicy: String
    let maxRuns: Int?
    let correlationToken: Int64
    let retryMaxAttempts: Int
    let retryInitialBackoffMs: Int64
    let cancellationToken: String
    let tagMask: Int64
    let policyProfile: String
    var runCount: Int
    var paused: Bool
    let callback: (Double) -> Void
  }

  private var cppBridge: SchedulerCppBridge?
  private var cppCallbacks = [Int: (Double) -> Void]()

  private var bgTask: UIBackgroundTaskIdentifier = .invalid
  private var tasksById: [Int: ScheduledTask] = [:]
  private var schedulerTimer: Timer?

  private var callbackCount = 0
  private var missedCount = 0
  private var wakeupCount = 0

  private var lateDispatchCount = 0
  private var latenessTotalMs = 0.0
  private var p95LatenessMs = 0.0
  private var latenessSamples: [Double] = []
  private var latenessDirtyCount = 0

  override init() {
    super.init()
    if Self.useCppEngine {
      cppBridge = SchedulerCppBridge()
    }
  }

  private func runOnMain(_ work: @escaping () -> Void) {
    if Thread.isMainThread {
      work()
    } else {
      DispatchQueue.main.async(execute: work)
    }
  }

  private func syncOnMain<T>(_ work: () -> T) -> T {
    if Thread.isMainThread {
      return work()
    }
    return DispatchQueue.main.sync(execute: work)
  }

  private func acquireBackgroundTask() {
    guard bgTask == .invalid else { return }
    bgTask = UIApplication.shared.beginBackgroundTask(withName: "NitroBackgroundTimer") { [weak self] in
      self?.releaseBackgroundTask()
    }
    if bgTask == .invalid {
      print("[NitroBackgroundTimer] Warning: Failed to acquire background task")
    }
  }

  private func releaseBackgroundTaskIfNeeded() {
    if Self.useCppEngine {
      guard let ids = cppBridge?.listActiveIds(), ids.isEmpty else { return }
      releaseBackgroundTask()
    } else {
      if tasksById.isEmpty { releaseBackgroundTask() }
    }
  }

  private func releaseBackgroundTask() {
    guard bgTask != .invalid else { return }
    UIApplication.shared.endBackgroundTask(bgTask)
    bgTask = .invalid
  }

  private func recordLateness(_ latenessMs: Double) {
    guard latenessMs > 0 else { return }
    lateDispatchCount += 1
    latenessTotalMs += latenessMs
    latenessSamples.append(latenessMs)
    if latenessSamples.count > 256 {
      latenessSamples.removeFirst(latenessSamples.count - 256)
    }
    latenessDirtyCount += 1
    if latenessDirtyCount < Self.latenessP95RecalcInterval {
      return
    }
    latenessDirtyCount = 0
    let sorted = latenessSamples.sorted()
    if !sorted.isEmpty {
      let idx = min(sorted.count - 1, Int(Double(sorted.count - 1) * 0.95))
      p95LatenessMs = sorted[idx]
    }
  }

  private func ensureSchedulerTickSwift() {
    schedulerTimer?.invalidate()
    schedulerTimer = nil

    let activeTasks = tasksById.values.filter { !$0.paused }
    guard let nextTask = activeTasks.min(by: { $0.nextRunAtMs < $1.nextRunAtMs }) else {
      releaseBackgroundTaskIfNeeded()
      return
    }

    let delayMs = max(0, nextTask.nextRunAtMs - Date().timeIntervalSince1970 * 1000)
    let delaySeconds = delayMs / 1000.0
    schedulerTimer = Timer.scheduledTimer(withTimeInterval: delaySeconds, repeats: false) { [weak self] _ in
      self?.runDueTasksSwift()
    }
  }

  private func ensureSchedulerTickCpp() {
    schedulerTimer?.invalidate()
    schedulerTimer = nil

    guard let bridge = cppBridge else {
      releaseBackgroundTask()
      return
    }

    let nextDue = bridge.nextDueMs()
    if nextDue == Int64.min {
      releaseBackgroundTaskIfNeeded()
      return
    }

    let now = Date().timeIntervalSince1970 * 1000
    let delayMs = max(0, Double(nextDue) - now)
    schedulerTimer =
      Timer.scheduledTimer(withTimeInterval: delayMs / 1000.0, repeats: false) { [weak self] _ in
        self?.runDueTasksCpp()
      }
  }

  private func runDueTasksSwift() {
    let now = Date().timeIntervalSince1970 * 1000
    let dueIds = tasksById.values
      .filter { !$0.paused && $0.nextRunAtMs <= now }
      .map(\.id)

    if !dueIds.isEmpty {
      wakeupCount += 1
    }

    for tid in dueIds {
      guard var task = tasksById[tid] else { continue }
      recordLateness(now - task.nextRunAtMs)
      task.callback(Double(tid))
      callbackCount += 1
      task.runCount += 1

      if task.kind == "interval" && (task.maxRuns == nil || task.runCount < task.maxRuns!) {
        let nextRun: Double
        switch task.driftPolicy {
        case "catchUp":
          nextRun = task.nextRunAtMs + task.intervalMs
        case "skipLate":
          nextRun = now + task.intervalMs
        default:
          nextRun = max(task.nextRunAtMs + task.intervalMs, now + 1)
        }
        if nextRun < now { missedCount += 1 }
        task.nextRunAtMs = nextRun
        tasksById[tid] = task
      } else {
        tasksById.removeValue(forKey: tid)
      }
    }

    ensureSchedulerTickSwift()
  }

  private func runDueTasksCpp() {
    guard let bridge = cppBridge else { return }
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    let pairs = bridge.popDuePairs(nowMs: now)
    var i = 0
    while i + 1 < pairs.count {
      let tid = pairs[i].intValue
      let scheduledDue = pairs[i + 1].int64Value
      recordLateness(Double(now) - Double(scheduledDue))
      cppCallbacks[tid]?(Double(tid))

      syncCountersFromCpp(bridge)

      if !bridge.isActive(timerId: tid) {
        cppCallbacks.removeValue(forKey: tid)
      }
      i += 2
    }
    syncCountersFromCpp(bridge)
    ensureSchedulerTickCpp()
  }

  private func syncCountersFromCpp(_ bridge: SchedulerCppBridge) {
    let stats = bridge.coreStats()
    callbackCount = stats["callbackCount"]?.intValue ?? callbackCount
    missedCount = stats["missedCount"]?.intValue ?? missedCount
    wakeupCount = stats["wakeupCount"]?.intValue ?? wakeupCount
  }

  private func encodeMetadataJson(
    correlationToken: Int64,
    retryMaxAttempts: Int,
    retryInitialBackoffMs: Int64,
    cancellationToken: String,
    tagMask: Int64,
    policyProfile: String
  ) -> String {
    let payload: [String: Any] = [
      "correlationToken": correlationToken,
      "retryMaxAttempts": retryMaxAttempts,
      "retryInitialBackoffMs": retryInitialBackoffMs,
      "cancellationToken": cancellationToken,
      "tagMask": tagMask,
      "policyProfile": policyProfile,
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
      return "{}"
    }
    return String(data: data, encoding: .utf8) ?? "{}"
  }

  private func applyPolicyProfile(
    profile: String,
    retryMax: Int,
    retryBackoffMs: Int64
  ) -> (Int, Int64) {
    switch profile {
    case "batterySaver":
      return (min(retryMax, 2), max(retryBackoffMs, 5_000))
    case "latencyFirst":
      return (max(retryMax, 1), min(retryBackoffMs, 250))
    default:
      return (retryMax, retryBackoffMs)
    }
  }

  func schedule(
    id: Double,
    delayMs: Double,
    kind: String,
    intervalMs: Double,
    group: String,
    driftPolicy: String,
    maxRuns: Double,
    correlationToken: Double,
    retryMaxAttempts: Double,
    retryInitialBackoffMs: Double,
    cancellationToken: String,
    tagMask: Double,
    policyProfile: String,
    callback: @escaping (Double) -> Void
  ) throws -> Double {
    let intId = Int(id)

    let normalizedKind = kind == "interval" ? "interval" : "timeout"
    let normalizedIntervalMs = max(1, intervalMs)
    let normalizedGroup = group.isEmpty ? Self.defaultGroup : group
    let normalizedMaxRuns: Int? = maxRuns <= 0 ? nil : Int(maxRuns)
    let normalizedCorrelationToken = Int64(correlationToken.rounded(.towardZero))
    let normalizedRetryMaxAttemptsRaw = max(0, Int(retryMaxAttempts.rounded(.towardZero)))
    let normalizedRetryInitialBackoffMsRaw = Int64(max(0, retryInitialBackoffMs).rounded(.towardZero))
    let normalizedCancellationToken = cancellationToken
    let normalizedTagMask = Int64(tagMask.rounded(.towardZero))
    let normalizedPolicyProfile = policyProfile.isEmpty ? "balanced" : policyProfile
    let (normalizedRetryMaxAttempts, normalizedRetryInitialBackoffMs) = applyPolicyProfile(
      profile: normalizedPolicyProfile,
      retryMax: normalizedRetryMaxAttemptsRaw,
      retryBackoffMs: normalizedRetryInitialBackoffMsRaw
    )

    runOnMain { [weak self] in
      guard let self else { return }

      let intExisting = Int(id)
      if Self.useCppEngine, let bridgeExisting = self.cppBridge {
        bridgeExisting.cancel(timerId: intExisting)
        self.cppCallbacks.removeValue(forKey: intExisting)
      } else {
        self.tasksById.removeValue(forKey: intExisting)
      }

      self.acquireBackgroundTask()

      if Self.useCppEngine, let bridge = self.cppBridge {
        let dueAt = Int64(Date().timeIntervalSince1970 * 1000 + max(0, delayMs))
        let cppMaxRuns: Int =
          normalizedKind == "timeout"
            ? 1
            : normalizedMaxRuns == nil ? Int(-1) : normalizedMaxRuns!
        self.cppCallbacks[intId] = callback
        let metadataJson = self.encodeMetadataJson(
          correlationToken: normalizedCorrelationToken,
          retryMaxAttempts: normalizedRetryMaxAttempts,
          retryInitialBackoffMs: normalizedRetryInitialBackoffMs,
          cancellationToken: normalizedCancellationToken,
          tagMask: normalizedTagMask,
          policyProfile: normalizedPolicyProfile
        )

        bridge.schedule(
          timerId: intId,
          dueAtMs: dueAt,
          kind: normalizedKind,
          intervalMs: Int64(normalizedIntervalMs.rounded(.towardZero)),
          group: normalizedGroup,
          driftPolicy: driftPolicy,
          maxRuns: cppMaxRuns,
          metadataJson: metadataJson
        )

        self.syncCountersFromCpp(bridge)
        self.ensureSchedulerTickCpp()
        return
      }

      self.tasksById[intId] = ScheduledTask(
        id: intId,
        nextRunAtMs: Date().timeIntervalSince1970 * 1000 + max(0, delayMs),
        kind: normalizedKind,
        intervalMs: normalizedIntervalMs,
        group: normalizedGroup,
        driftPolicy: driftPolicy,
        maxRuns: normalizedMaxRuns,
        correlationToken: normalizedCorrelationToken,
        retryMaxAttempts: normalizedRetryMaxAttempts,
        retryInitialBackoffMs: normalizedRetryInitialBackoffMs,
        cancellationToken: normalizedCancellationToken,
        tagMask: normalizedTagMask,
        policyProfile: normalizedPolicyProfile,
        runCount: 0,
        paused: false,
        callback: callback
      )
      self.ensureSchedulerTickSwift()
    }

    return id
  }

  func cancel(id: Double) throws {
    let intId = Int(id)

    runOnMain { [weak self] in
      guard let self else { return }
      if Self.useCppEngine, let bridge = self.cppBridge {
        bridge.cancel(timerId: intId)
        self.cppCallbacks.removeValue(forKey: intId)
        self.syncCountersFromCpp(bridge)
        self.ensureSchedulerTickCpp()
      } else {
        self.tasksById.removeValue(forKey: intId)
        self.ensureSchedulerTickSwift()
      }
    }
  }

  func pauseGroup(group: String) throws -> Double {
    var affected = 0
    runOnMain { [weak self] in
      guard let self else { return }
      if Self.useCppEngine, let bridge = self.cppBridge {
        affected = bridge.pause(group: group)
        self.ensureSchedulerTickCpp()
      } else {
        for (tid, var task) in self.tasksById where task.group == group && !task.paused {
          task.paused = true
          self.tasksById[tid] = task
          affected += 1
        }
        self.ensureSchedulerTickSwift()
      }
    }
    return Double(affected)
  }

  func resumeGroup(group: String) throws -> Double {
    var affected = 0
    runOnMain { [weak self] in
      guard let self else { return }
      if Self.useCppEngine, let bridge = self.cppBridge {
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        affected = bridge.resume(group: group, nowMs: nowMs)
        self.ensureSchedulerTickCpp()
      } else {
        let now = Date().timeIntervalSince1970 * 1000
        for (tid, var task) in self.tasksById where task.group == group && task.paused {
          task.paused = false
          task.nextRunAtMs = max(task.nextRunAtMs, now + 1)
          self.tasksById[tid] = task
          affected += 1
        }
        self.ensureSchedulerTickSwift()
      }
    }
    return Double(affected)
  }

  func cancelGroup(group: String) throws -> Double {
    var removed = 0
    runOnMain { [weak self] in
      guard let self else { return }
      if Self.useCppEngine, let bridge = self.cppBridge {
        removed = bridge.cancel(group: group)
        let alive = Set(bridge.listActiveIds().map { $0.intValue })
        self.cppCallbacks = self.cppCallbacks.filter { alive.contains($0.key) }
        self.ensureSchedulerTickCpp()
      } else {
        let ids = self.tasksById.values.filter { $0.group == group }.map(\.id)
        removed = ids.count
        for tid in ids { self.tasksById.removeValue(forKey: tid) }
        self.ensureSchedulerTickSwift()
      }
    }
    return Double(removed)
  }

  func listActiveTimerIds() throws -> [Double] {
    if Self.useCppEngine, let bridge = cppBridge {
      return bridge.listActiveIds().map { Double($0.intValue) }.sorted()
    }
    return tasksById.keys.sorted().map(Double.init)
  }

  func getStatsJson() throws -> String {
    if Self.useCppEngine, let bridge = cppBridge {
      syncCountersFromCpp(bridge)
      let core = bridge.coreStats()
      let gj = bridge.groupsJson().data(using: .utf8) ?? Data()
      let groupsObj = (try? JSONSerialization.jsonObject(with: gj)) as? [String: Any] ?? [:]

      let payload: [String: Any] = [
        "activeCount": (core["activeCount"] as? NSNumber)?.intValue ?? bridge.listActiveIds().count,
        "callbackCount": callbackCount,
        "missedCount": missedCount,
        "wakeupCount": wakeupCount,
        "lateDispatchCount": lateDispatchCount,
        "avgLatenessMs": lateDispatchCount == 0 ? 0 : latenessTotalMs / Double(lateDispatchCount),
        "p95LatenessMs": p95LatenessMs,
        "groups": groupsObj.mapValues { $0 as Any },
      ]
      guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
        return "{}"
      }
      return String(data: data, encoding: .utf8) ?? "{}"
    }

    let groups =
      Dictionary(uniqueKeysWithValues: Dictionary(grouping: tasksById.values, by: \.group).map {
        ($0.key, $0.value.count)
      })

    let payload: [String: Any] = [
      "activeCount": tasksById.count,
      "callbackCount": callbackCount,
      "missedCount": missedCount,
      "wakeupCount": wakeupCount,
      "lateDispatchCount": lateDispatchCount,
      "avgLatenessMs": lateDispatchCount == 0 ? 0 : latenessTotalMs / Double(lateDispatchCount),
      "p95LatenessMs": p95LatenessMs,
      "groups": groups.mapValues { $0 as Any },
    ]

    guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
      return "{}"
    }
    return String(data: data, encoding: .utf8) ?? "{}"
  }

  func getPersistWireJson() throws -> String {
    syncOnMain {
      if Self.useCppEngine, let bridge = cppBridge {
        return bridge.exportPersistWireJson()
      }
      let tasksPayload: [[String: Any]] =
        tasksById.keys.sorted().compactMap { key in
          guard let task = tasksById[key] else { return nil }
          return [
            "id": task.id,
            "dueAtMs": task.nextRunAtMs,
            "kind": task.kind,
            "intervalMs": task.intervalMs,
            "group": task.group,
            "driftPolicy": task.driftPolicy,
            "maxRuns": task.maxRuns ?? -1,
            "runCount": task.runCount,
            "paused": task.paused,
            "metadataJson": encodeMetadataJson(
              correlationToken: task.correlationToken,
              retryMaxAttempts: task.retryMaxAttempts,
              retryInitialBackoffMs: task.retryInitialBackoffMs,
              cancellationToken: task.cancellationToken,
              tagMask: task.tagMask,
              policyProfile: task.policyProfile
            ),
          ]
        }
      let payload: [String: Any] = ["version": 1, "tasks": tasksPayload]
      guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
        return "{\"version\":1,\"tasks\":[]}"
      }
      return String(data: data, encoding: .utf8) ?? "{\"version\":1,\"tasks\":[]}"
    }
  }

  func restorePersistWireJson(wireJson: String) throws {
    syncOnMain {
      if Self.useCppEngine, let bridge = cppBridge {
        guard let data = wireJson.data(using: .utf8),
              let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let ver = raw["version"] as? Int,
              ver == 1,
              let taskArr = raw["tasks"] as? [[String: Any]] else {
          return
        }
        cppCallbacks.removeAll()
        bridge.clearAllTasks()
        for t in taskArr {
          let idNum = (t["id"] as? NSNumber)?.intValue ?? 0
          let dueMs = (t["dueAtMs"] as? NSNumber)?.doubleValue ?? 0
          let due = Int64(dueMs.rounded())
          let kindStr = (t["kind"] as? String) ?? "timeout"
          let iv = Int64(((t["intervalMs"] as? NSNumber)?.doubleValue ?? 1).rounded())
          let groupStr: String = {
            if let g = t["group"] as? String, !g.isEmpty { return g }
            return Self.defaultGroup
          }()
          let drift = (t["driftPolicy"] as? String) ?? "coalesce"
          let maxRuns = (t["maxRuns"] as? NSNumber)?.intValue ?? -1
          let runCnt = (t["runCount"] as? NSNumber)?.intValue ?? 0
          let paused =
            (t["paused"] as? Bool)
              ?? ((t["paused"] as? NSNumber)?.boolValue ?? false)
          let metadataJson = (t["metadataJson"] as? String) ?? ""

          bridge.importTask(
            timerId: idNum,
            dueAtMs: due,
            kind: kindStr,
            intervalMs: max(1, iv),
            group: groupStr,
            driftPolicy: drift,
            maxRuns: maxRuns,
            runCount: runCnt,
            paused: paused,
            metadataJson: metadataJson
          )
        }
        ensureSchedulerTickCpp()
        releaseBackgroundTaskIfNeeded()
        return
      }
      print("[NitroBackgroundTimer] restorePersistWireJson ignored in legacy Swift scheduler mode")
    }
  }

  func setTimeout(id: Double, duration: Double, callback: @escaping (Double) -> Void) throws -> Double {
    try schedule(
      id: id,
      delayMs: duration,
      kind: "timeout",
      intervalMs: duration,
      group: Self.defaultGroup,
      driftPolicy: "coalesce",
      maxRuns: 1,
      correlationToken: 0,
      retryMaxAttempts: 0,
      retryInitialBackoffMs: 0,
      cancellationToken: "",
      tagMask: 0,
      policyProfile: "balanced",
      callback: callback
    )
  }

  func clearTimeout(id: Double) throws {
    try cancel(id: id)
  }

  func setInterval(id: Double, interval: Double, callback: @escaping (Double) -> Void) throws -> Double {
    try schedule(
      id: id,
      delayMs: interval,
      kind: "interval",
      intervalMs: interval,
      group: Self.defaultGroup,
      driftPolicy: "coalesce",
      maxRuns: 0,
      correlationToken: 0,
      retryMaxAttempts: 0,
      retryInitialBackoffMs: 0,
      cancellationToken: "",
      tagMask: 0,
      policyProfile: "balanced",
      callback: callback
    )
  }

  func clearInterval(id: Double) throws {
    try cancel(id: id)
  }

  deinit {
    let releasingTask = bgTask

    let cleanup = {
      self.schedulerTimer?.invalidate()
      self.schedulerTimer = nil
      self.tasksById.removeAll()
      self.cppCallbacks.removeAll()
      self.cppBridge = nil
      if releasingTask != .invalid {
        UIApplication.shared.endBackgroundTask(releasingTask)
      }
    }

    if Thread.isMainThread {
      cleanup()
    } else {
      DispatchQueue.main.async(execute: cleanup)
    }
  }
}
