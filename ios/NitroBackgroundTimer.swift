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

    runOnMain { [weak self] in
      guard let self else { return }
      self.clearTimeout(id: id)
      self.acquireBackgroundTask()

      let timer = Timer.scheduledTimer(withTimeInterval: duration / 1000.0, repeats: false) { [weak self] _ in
        guard let self else { return }
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

    runOnMain { [weak self] in
      guard let self else { return }
      if let timer = self.timeoutTimers[intId] {
        timer.invalidate()
        self.timeoutTimers.removeValue(forKey: intId)
        self.releaseBackgroundTaskIfNeeded()
      } else {
        self.releaseBackgroundTaskIfNeeded()
      }
    }
  }

  // MARK: - Interval
  func setInterval(id: Double, interval: Double, callback: @escaping (Double) -> Void) -> Double {
    let intId = Int(id)

    runOnMain { [weak self] in
      guard let self else { return }
      self.clearInterval(id: id)
      self.acquireBackgroundTask()

      let timer = Timer.scheduledTimer(withTimeInterval: interval / 1000.0, repeats: true) { [weak self] _ in
        guard let self else { return }
        // Interval might have been cleared/replaced while callback is running.
        guard self.intervalTimers[intId] != nil else { return }
        callback(id)
      }

      self.intervalTimers[intId] = timer
    }

    return id
  }

  func clearInterval(id: Double) {
    let intId = Int(id)

    runOnMain { [weak self] in
      guard let self else { return }
      if let timer = self.intervalTimers[intId] {
        timer.invalidate()
        self.intervalTimers.removeValue(forKey: intId)
        self.releaseBackgroundTaskIfNeeded()
      } else {
        self.releaseBackgroundTaskIfNeeded()
      }
    }
  }

  deinit {
    let timeoutValues = Array(timeoutTimers.values)
    let intervalValues = Array(intervalTimers.values)
    let releasingTask = bgTask

    let cleanup = {
      timeoutValues.forEach { $0.invalidate() }
      intervalValues.forEach { $0.invalidate() }
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
