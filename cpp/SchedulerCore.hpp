#pragma once

#include <cstdint>
#include <optional>
#include <queue>
#include <string>
#include <unordered_map>
#include <vector>

namespace margelo::nitro::backgroundtimer {

struct TaskRecord {
  int32_t id;
  int64_t dueAtMs;
  std::string kind;
  int64_t intervalMs;
  std::string group;
  std::string driftPolicy;
  std::optional<int32_t> maxRuns;
  int32_t runCount;
  bool paused;
};

struct SchedulerStats {
  int32_t activeCount = 0;
  int64_t callbackCount = 0;
  int64_t missedCount = 0;
  int64_t wakeupCount = 0;
};

class SchedulerCore {
 public:
  SchedulerCore() = default;
  void schedule(TaskRecord task);
  void cancel(int32_t id);
  int32_t cancelGroup(const std::string& group);
  int32_t pauseGroup(const std::string& group);
  int32_t resumeGroup(const std::string& group, int64_t nowMs);
  std::vector<TaskRecord> popDue(int64_t nowMs);
  std::vector<int32_t> listActiveIds() const;
  SchedulerStats getStats() const;

 private:
  struct QueueEntry {
    int64_t dueAtMs;
    int32_t id;
    uint64_t generation;
    bool operator<(const QueueEntry& other) const { return dueAtMs > other.dueAtMs; }
  };

  void requeue(TaskRecord& task, int64_t nowMs);

  std::unordered_map<int32_t, TaskRecord> tasksById_;
  std::unordered_map<int32_t, uint64_t> generations_;
  std::priority_queue<QueueEntry> queue_;
  SchedulerStats stats_;
};

}  // namespace margelo::nitro::backgroundtimer
