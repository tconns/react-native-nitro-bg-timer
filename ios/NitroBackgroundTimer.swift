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

  private var bgTask: UIBackgroundTaskIdentifier = .invalid
  private var timeoutTimers: [Int: Timer] = [:]
  private var intervalTimers: [Int: Timer] = [:]

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
    if timeoutTimers.isEmpty && intervalTimers.isEmpty {
      releaseBackgroundTask()
    }
  }

  private func releaseBackgroundTask() {
    guard bgTask != .invalid else { return }

    UIApplication.shared.endBackgroundTask(bgTask)
    bgTask = .invalid
  }

  // MARK: - Timeout
  func setTimeout(id: Double, duration: Double, callback: @escaping (Double) -> Void) -> Double {
    let intId = Int(id)

    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      // Clear existing timer with same ID (inline to avoid async race)
      if let existing = self.timeoutTimers[intId] {
        existing.invalidate()
        self.timeoutTimers.removeValue(forKey: intId)
      }

      self.acquireBackgroundTask()

      let timer = Timer.scheduledTimer(withTimeInterval: duration / 1000.0, repeats: false) { [weak self] _ in
        guard let self = self else { return }

        callback(id)

        self.timeoutTimers.removeValue(forKey: intId)
        self.releaseBackgroundTaskIfNeeded()
      }

      self.timeoutTimers[intId] = timer
    }

    return id
  }

  func clearTimeout(id: Double) {
    let intId = Int(id)

    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      if let timer = self.timeoutTimers[intId] {
        timer.invalidate()
        self.timeoutTimers.removeValue(forKey: intId)
        self.releaseBackgroundTaskIfNeeded()
      }
    }
  }

  // MARK: - Interval
  func setInterval(id: Double, interval: Double, callback: @escaping (Double) -> Void) -> Double {
    let intId = Int(id)

    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      // Clear existing timer with same ID (inline to avoid async race)
      if let existing = self.intervalTimers[intId] {
        existing.invalidate()
        self.intervalTimers.removeValue(forKey: intId)
      }

      self.acquireBackgroundTask()

      let timer = Timer.scheduledTimer(withTimeInterval: interval / 1000.0, repeats: true) { [weak self] _ in
        guard let self = self else { return }

        callback(id)
      }

      self.intervalTimers[intId] = timer
    }

    return id
  }

  func clearInterval(id: Double) {
    let intId = Int(id)

    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      if let timer = self.intervalTimers[intId] {
        timer.invalidate()
        self.intervalTimers.removeValue(forKey: intId)
        self.releaseBackgroundTaskIfNeeded()
      }
    }
  }

  deinit {
    // Copy out all values so the closure does not capture self (refcount 0 during deinit).
    // Dictionary is a value type in Swift, so this is a safe copy.
    let timeouts = timeoutTimers
    let intervals = intervalTimers
    let task = bgTask

    let doCleanup = {
      timeouts.values.forEach { $0.invalidate() }
      intervals.values.forEach { $0.invalidate() }
      if task != .invalid {
        UIApplication.shared.endBackgroundTask(task)
      }
    }

    if Thread.isMainThread {
      doCleanup()
    } else {
      DispatchQueue.main.sync { doCleanup() }
    }
  }
}
