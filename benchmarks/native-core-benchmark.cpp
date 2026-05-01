#include <chrono>
#include <cstdint>
#include <iostream>

#include "../cpp/SchedulerCore.hpp"

using nitro_bt_scheduler::SchedulerCore;
using nitro_bt_scheduler::TaskRecord;

int main() {
  SchedulerCore core;
  constexpr int kTasks = 50000;

  const auto start = std::chrono::steady_clock::now();
  const auto nowMs = static_cast<int64_t>(
      std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::system_clock::now().time_since_epoch())
          .count());

  for (int i = 1; i <= kTasks; i++) {
    TaskRecord t{};
    t.id = i;
    t.dueAtMs = nowMs + (i % 1000);
    t.kind = "interval";
    t.intervalMs = 1000 + (i % 200);
    t.group = "bench";
    t.driftPolicy = "coalesce";
    t.maxRuns = std::nullopt;
    t.runCount = 0;
    t.paused = false;
    t.metadataJson = "{}";
    core.schedule(t);
  }

  for (int i = 1; i <= kTasks; i += 37) {
    core.cancel(i);
  }

  (void)core.popDue(nowMs + 1500);
  const auto elapsedMs = std::chrono::duration_cast<std::chrono::microseconds>(
                             std::chrono::steady_clock::now() - start)
                             .count() /
                         1000.0;

  const auto stats = core.getStats();
  std::cout << "{"
            << "\"benchmark\":\"nativeCoreBenchmark\","
            << "\"taskCount\":" << kTasks << ","
            << "\"elapsedMs\":" << elapsedMs << ","
            << "\"activeCount\":" << stats.activeCount << ","
            << "\"callbackCount\":" << stats.callbackCount << ","
            << "\"missedCount\":" << stats.missedCount << ","
            << "\"wakeupCount\":" << stats.wakeupCount << "}\n";
  return 0;
}
