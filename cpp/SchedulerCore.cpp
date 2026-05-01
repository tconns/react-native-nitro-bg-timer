#include "SchedulerCore.hpp"

#include <algorithm>

namespace margelo::nitro::backgroundtimer {

void SchedulerCore::schedule(TaskRecord task) {
  cancel(task.id);
  task.runCount = 0;
  task.paused = false;
  tasksById_[task.id] = task;
  const uint64_t generation = ++generations_[task.id];
  queue_.push(QueueEntry{task.dueAtMs, task.id, generation});
}

void SchedulerCore::cancel(int32_t id) {
  tasksById_.erase(id);
  generations_.erase(id);
}

int32_t SchedulerCore::cancelGroup(const std::string& group) {
  int32_t removed = 0;
  for (auto it = tasksById_.begin(); it != tasksById_.end();) {
    if (it->second.group == group) {
      generations_.erase(it->first);
      it = tasksById_.erase(it);
      removed += 1;
    } else {
      ++it;
    }
  }
  return removed;
}

int32_t SchedulerCore::pauseGroup(const std::string& group) {
  int32_t affected = 0;
  for (auto& [_, task] : tasksById_) {
    if (task.group == group && !task.paused) {
      task.paused = true;
      affected += 1;
    }
  }
  return affected;
}

int32_t SchedulerCore::resumeGroup(const std::string& group, int64_t nowMs) {
  int32_t affected = 0;
  for (auto& [id, task] : tasksById_) {
    if (task.group == group && task.paused) {
      task.paused = false;
      task.dueAtMs = std::max(task.dueAtMs, nowMs + 1);
      const uint64_t generation = ++generations_[id];
      queue_.push(QueueEntry{task.dueAtMs, id, generation});
      affected += 1;
    }
  }
  return affected;
}

std::vector<TaskRecord> SchedulerCore::popDue(int64_t nowMs) {
  std::vector<TaskRecord> due;
  while (!queue_.empty()) {
    const QueueEntry top = queue_.top();
    if (top.dueAtMs > nowMs) {
      break;
    }
    queue_.pop();
    const auto generationIt = generations_.find(top.id);
    if (generationIt == generations_.end() || generationIt->second != top.generation) {
      continue;
    }
    const auto taskIt = tasksById_.find(top.id);
    if (taskIt == tasksById_.end() || taskIt->second.paused) {
      continue;
    }

    TaskRecord task = taskIt->second;
    due.push_back(task);
    stats_.callbackCount += 1;

    taskIt->second.runCount += 1;
    const bool shouldRepeat =
        taskIt->second.kind == "interval" &&
        (!taskIt->second.maxRuns.has_value() || taskIt->second.runCount < taskIt->second.maxRuns.value());

    if (shouldRepeat) {
      requeue(taskIt->second, nowMs);
    } else {
      cancel(task.id);
    }
  }
  if (!due.empty()) {
    stats_.wakeupCount += 1;
  }
  return due;
}

void SchedulerCore::requeue(TaskRecord& task, int64_t nowMs) {
  const int64_t intervalMs = std::max<int64_t>(1, task.intervalMs);
  if (task.driftPolicy == "catchUp") {
    task.dueAtMs += intervalMs;
  } else if (task.driftPolicy == "skipLate") {
    task.dueAtMs = nowMs + intervalMs;
  } else {
    task.dueAtMs = std::max(task.dueAtMs + intervalMs, nowMs + 1);
  }
  const uint64_t generation = ++generations_[task.id];
  queue_.push(QueueEntry{task.dueAtMs, task.id, generation});
}

std::vector<int32_t> SchedulerCore::listActiveIds() const {
  std::vector<int32_t> ids;
  ids.reserve(tasksById_.size());
  for (const auto& [id, _] : tasksById_) {
    ids.push_back(id);
  }
  std::sort(ids.begin(), ids.end());
  return ids;
}

SchedulerStats SchedulerCore::getStats() const {
  SchedulerStats out = stats_;
  out.activeCount = static_cast<int32_t>(tasksById_.size());
  return out;
}

}  // namespace margelo::nitro::backgroundtimer
