//
//  HybridNitroBackgroundTimer.swift
//  Pods
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
    if bgTask == .invalid {
      bgTask = UIApplication.shared.beginBackgroundTask(withName: "NitroBackgroundTimer") {
        self.releaseBackgroundTask()
      }
    }
  }

  private func releaseBackgroundTaskIfNeeded() {
    if timeoutTimers.isEmpty && intervalTimers.isEmpty {
      releaseBackgroundTask()
    }
  }

  private func releaseBackgroundTask() {
    if bgTask != .invalid {
      UIApplication.shared.endBackgroundTask(bgTask)
      bgTask = .invalid
    }
  }

  // MARK: - Timeout
  override func setTimeout(id: Double, duration: Double, callback: @escaping (Double) -> Void) -> Double {
    let intId = Int(id)
    DispatchQueue.main.async {
      self.clearTimeout(id: id)
      self.acquireBackgroundTask()

      let timer = Timer.scheduledTimer(withTimeInterval: duration / 1000.0, repeats: false) { [weak self] _ in
        guard let self = self else { return }
        do {
          callback(id)
        }
        self.timeoutTimers.removeValue(forKey: intId)
        self.releaseBackgroundTaskIfNeeded()
      }
      self.timeoutTimers[intId] = timer
    }
    return id
  }

  override func clearTimeout(id: Double) {
    let intId = Int(id)
    DispatchQueue.main.async {
      if let timer = self.timeoutTimers[intId] {
        timer.invalidate()
        self.timeoutTimers.removeValue(forKey: intId)
        self.releaseBackgroundTaskIfNeeded()
      }
    }
  }

  // MARK: - Interval
  override func setInterval(id: Double, interval: Double, callback: @escaping (Double) -> Void) -> Double {
    let intId = Int(id)
    DispatchQueue.main.async {
      self.clearInterval(id: id)
      self.acquireBackgroundTask()

      let timer = Timer.scheduledTimer(withTimeInterval: interval / 1000.0, repeats: true) { _ in
        do {
          callback(id)
        }
      }
      self.intervalTimers[intId] = timer
    }
    return id
  }

  override func clearInterval(id: Double) {
    let intId = Int(id)
    DispatchQueue.main.async {
      if let timer = self.intervalTimers[intId] {
        timer.invalidate()
        self.intervalTimers.removeValue(forKey: intId)
        self.releaseBackgroundTaskIfNeeded()
      }
    }
  }

  deinit {
    for (_, timer) in timeoutTimers {
      timer.invalidate()
    }
    for (_, timer) in intervalTimers {
      timer.invalidate()
    }
    releaseBackgroundTask()
  }
}
