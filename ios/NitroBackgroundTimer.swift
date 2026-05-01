//
//  NitroBackgroundTimer.swift
//  NitroBackgroundTimer
//
//  Created by tconns94 on 8/21/2025.
//

import Foundation
import UIKit
import NitroModules

class NitroBackgroundTimer: HybridNitroBackgroundTimerSpec {
  private static let defaultGroup = "default"

  private struct ScheduledTask {
    let id: Int
    var nextRunAtMs: Double
    let kind: String
    let intervalMs: Double
    let group: String
    let driftPolicy: String
    let maxRuns: Int?
    var runCount: Int
    var paused: Bool
    let callback: (Double) -> Void
  }

  private var bgTask: UIBackgroundTaskIdentifier = .invalid
  private var tasksById: [Int: ScheduledTask] = [:]
  private var schedulerTimer: Timer?
  private var callbackCount: Int = 0
  private var missedCount: Int = 0
  private var wakeupCount: Int = 0
  private var lateDispatchCount: Int = 0
  private var latenessTotalMs: Double = 0
  private var p95LatenessMs: Double = 0
  private var latenessSamples: [Double] = []

  private func runOnMain(_ work: @escaping () -> Void) {
    if Thread.isMainThread {
      work()
    } else {
      DispatchQueue.main.async(execute: work)
    }
  }

  // MARK: - Background task helpers
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
    if tasksById.isEmpty {
      releaseBackgroundTask()
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
    let sorted = latenessSamples.sorted()
    if !sorted.isEmpty {
      let idx = min(sorted.count - 1, Int(Double(sorted.count - 1) * 0.95))
      p95LatenessMs = sorted[idx]
    }
  }

  private func ensureSchedulerTick() {
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
      self?.runDueTasks()
    }
  }

  private func runDueTasks() {
    let now = Date().timeIntervalSince1970 * 1000
    let dueIds = tasksById.values
      .filter { !$0.paused && $0.nextRunAtMs <= now }
      .map { $0.id }

    if !dueIds.isEmpty {
      wakeupCount += 1
    }

    for id in dueIds {
      guard var task = tasksById[id] else { continue }
      recordLateness(now - task.nextRunAtMs)
      task.callback(Double(id))
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
        if nextRun < now {
          missedCount += 1
        }
        task.nextRunAtMs = nextRun
        tasksById[id] = task
      } else {
        tasksById.removeValue(forKey: id)
      }
    }

    ensureSchedulerTick()
  }

  func schedule(
    id: Double,
    delayMs: Double,
    kind: String,
    intervalMs: Double,
    group: String,
    driftPolicy: String,
    maxRuns: Double,
    callback: @escaping (Double) -> Void
  ) -> Double {
    let intId = Int(id)
    let normalizedKind = kind == "interval" ? "interval" : "timeout"
    let normalizedIntervalMs = max(1, intervalMs)
    let normalizedGroup = group.isEmpty ? Self.defaultGroup : group
    let normalizedMaxRuns: Int? = maxRuns <= 0 ? nil : Int(maxRuns)

    runOnMain { [weak self] in
      guard let self else { return }
      self.cancel(id: id)
      self.acquireBackgroundTask()
      self.tasksById[intId] = ScheduledTask(
        id: intId,
        nextRunAtMs: Date().timeIntervalSince1970 * 1000 + max(0, delayMs),
        kind: normalizedKind,
        intervalMs: normalizedIntervalMs,
        group: normalizedGroup,
        driftPolicy: driftPolicy,
        maxRuns: normalizedMaxRuns,
        runCount: 0,
        paused: false,
        callback: callback
      )
      self.ensureSchedulerTick()
    }

    return id
  }

  func cancel(id: Double) {
    let intId = Int(id)
    runOnMain { [weak self] in
      guard let self else { return }
      self.tasksById.removeValue(forKey: intId)
      self.ensureSchedulerTick()
    }
  }

  func pauseGroup(group: String) -> Double {
    var affected = 0
    runOnMain { [weak self] in
      guard let self else { return }
      for (id, var task) in self.tasksById where task.group == group && !task.paused {
        task.paused = true
        self.tasksById[id] = task
        affected += 1
      }
      self.ensureSchedulerTick()
    }
    return Double(affected)
  }

  func resumeGroup(group: String) -> Double {
    var affected = 0
    runOnMain { [weak self] in
      guard let self else { return }
      let now = Date().timeIntervalSince1970 * 1000
      for (id, var task) in self.tasksById where task.group == group && task.paused {
        task.paused = false
        task.nextRunAtMs = max(task.nextRunAtMs, now + 1)
        self.tasksById[id] = task
        affected += 1
      }
      self.ensureSchedulerTick()
    }
    return Double(affected)
  }

  func cancelGroup(group: String) -> Double {
    var removed = 0
    runOnMain { [weak self] in
      guard let self else { return }
      let ids = self.tasksById.values.filter { $0.group == group }.map(\.id)
      removed = ids.count
      for id in ids {
        self.tasksById.removeValue(forKey: id)
      }
      self.ensureSchedulerTick()
    }
    return Double(removed)
  }

  func listActiveTimerIds() -> [Double] {
    tasksById.keys.sorted().map(Double.init)
  }

  func getStatsJson() -> String {
    let groups = Dictionary(grouping: tasksById.values, by: \.group).mapValues(\.count)
    let payload: [String: Any] = [
      "activeCount": tasksById.count,
      "callbackCount": callbackCount,
      "missedCount": missedCount,
      "wakeupCount": wakeupCount,
      "lateDispatchCount": lateDispatchCount,
      "avgLatenessMs": lateDispatchCount == 0 ? 0 : latenessTotalMs / Double(lateDispatchCount),
      "p95LatenessMs": p95LatenessMs,
      "groups": groups,
    ]

    guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
          let text = String(data: data, encoding: .utf8) else {
      return "{\"activeCount\":0,\"callbackCount\":0,\"missedCount\":0,\"wakeupCount\":0,\"lateDispatchCount\":0,\"avgLatenessMs\":0,\"p95LatenessMs\":0,\"groups\":{}}"
    }
    return text
  }

  func setTimeout(id: Double, duration: Double, callback: @escaping (Double) -> Void) -> Double {
    schedule(
      id: id,
      delayMs: duration,
      kind: "timeout",
      intervalMs: duration,
      group: Self.defaultGroup,
      driftPolicy: "coalesce",
      maxRuns: 1,
      callback: callback
    )
  }

  func clearTimeout(id: Double) {
    cancel(id: id)
  }

  func setInterval(id: Double, interval: Double, callback: @escaping (Double) -> Void) -> Double {
    schedule(
      id: id,
      delayMs: interval,
      kind: "interval",
      intervalMs: interval,
      group: Self.defaultGroup,
      driftPolicy: "coalesce",
      maxRuns: 0,
      callback: callback
    )
  }

  func clearInterval(id: Double) {
    cancel(id: id)
  }

  deinit {
    let releasingTask = bgTask

    let cleanup = {
      self.schedulerTimer?.invalidate()
      self.schedulerTimer = nil
      self.tasksById.removeAll()
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
