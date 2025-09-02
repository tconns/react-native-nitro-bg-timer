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
  private let serialQueue = DispatchQueue(label: "com.nitro.backgroundtimer.queue", qos: .userInitiated)

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
  override func setTimeout(id: Double, duration: Double, callback: @escaping (Double) -> Void) -> Double {
    let intId = Int(id)
    
    serialQueue.async { [weak self] in
      guard let self = self else { return }
      
      DispatchQueue.main.async {
        // Clear existing timer with same ID
        self.clearTimeout(id: id)
        self.acquireBackgroundTask()

        let timer = Timer.scheduledTimer(withTimeInterval: duration / 1000.0, repeats: false) { [weak self] _ in
          guard let self = self else { return }
          
          // Execute callback
          callback(id)
          
          // Cleanup
          self.serialQueue.async {
            DispatchQueue.main.async {
              self.timeoutTimers.removeValue(forKey: intId)
              self.releaseBackgroundTaskIfNeeded()
            }
          }
        }
        
        self.timeoutTimers[intId] = timer
      }
    }
    
    return id
  }

  override func clearTimeout(id: Double) {
    let intId = Int(id)
    
    serialQueue.async { [weak self] in
      guard let self = self else { return }
      
      DispatchQueue.main.async {
        if let timer = self.timeoutTimers[intId] {
          timer.invalidate()
          self.timeoutTimers.removeValue(forKey: intId)
          self.releaseBackgroundTaskIfNeeded()
        }
      }
    }
  }

  // MARK: - Interval
  override func setInterval(id: Double, interval: Double, callback: @escaping (Double) -> Void) -> Double {
    let intId = Int(id)
    
    serialQueue.async { [weak self] in
      guard let self = self else { return }
      
      DispatchQueue.main.async {
        // Clear existing timer with same ID
        self.clearInterval(id: id)
        self.acquireBackgroundTask()

        let timer = Timer.scheduledTimer(withTimeInterval: interval / 1000.0, repeats: true) { [weak self] _ in
          guard let self = self else { return }
          
          // Execute callback
          callback(id)
        }
        
        self.intervalTimers[intId] = timer
      }
    }
    
    return id
  }

  override func clearInterval(id: Double) {
    let intId = Int(id)
    
    serialQueue.async { [weak self] in
      guard let self = self else { return }
      
      DispatchQueue.main.async {
        if let timer = self.intervalTimers[intId] {
          timer.invalidate()
          self.intervalTimers.removeValue(forKey: intId)
          self.releaseBackgroundTaskIfNeeded()
        }
      }
    }
  }

  deinit {
    serialQueue.sync {
      DispatchQueue.main.sync {
        // Invalidate all timers
        timeoutTimers.values.forEach { $0.invalidate() }
        intervalTimers.values.forEach { $0.invalidate() }
        
        // Clear collections
        timeoutTimers.removeAll()
        intervalTimers.removeAll()
        
        // Release background task
        releaseBackgroundTask()
      }
    }
  }
}
