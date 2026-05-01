#include "SchedulerCore.hpp"

#include <algorithm>
#include <climits>
#include <sstream>

namespace nitro_bt_scheduler {

namespace {

std::string jsonEscapeToken(const std::string& raw) {
  std::ostringstream out;
  out << '"';
  for (unsigned char const c : raw) {
    if (c == '"' || c == '\\') {
      out << '\\' << static_cast<char>(c);
    } else if (c < 0x20) {
      out << ' ';
    } else {
      out << static_cast<char>(c);
    }
  }
  out << '"';
  return out.str();
}

}  // namespace

void SchedulerCore::schedule(TaskRecord task) {
  std::lock_guard<std::recursive_mutex> lock(mutex_);
  cancel(task.id);
  task.runCount = 0;
  task.paused = false;
  tasksById_[task.id] = task;
  const uint64_t generation = ++generations_[task.id];
  queue_.push(QueueEntry{task.dueAtMs, task.id, generation});
}

void SchedulerCore::cancel(int32_t id) {
  std::lock_guard<std::recursive_mutex> lock(mutex_);
  tasksById_.erase(id);
  generations_.erase(id);
}

int32_t SchedulerCore::cancelGroup(const std::string& group) {
  std::lock_guard<std::recursive_mutex> lock(mutex_);
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
  std::lock_guard<std::recursive_mutex> lock(mutex_);
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
  std::lock_guard<std::recursive_mutex> lock(mutex_);
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
  std::lock_guard<std::recursive_mutex> lock(mutex_);
  std::vector<TaskRecord> due;
  while (compactQueueHeadLocked()) {
    const QueueEntry top = queue_.top();
    if (top.dueAtMs > nowMs) {
      break;
    }
    queue_.pop();
    const auto taskIt = tasksById_.find(top.id);
    TaskRecord fired = taskIt->second;
    due.push_back(fired);
    stats_.callbackCount += 1;

    taskIt->second.runCount += 1;
    const bool shouldRepeat =
        taskIt->second.kind == "interval" &&
        (!taskIt->second.maxRuns.has_value() || taskIt->second.runCount < taskIt->second.maxRuns.value());

    if (shouldRepeat) {
      requeue(taskIt->second, nowMs);
    } else {
      tasksById_.erase(taskIt);
      generations_.erase(fired.id);
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
  if (task.dueAtMs < nowMs) {
    stats_.missedCount += 1;
  }
  const uint64_t generation = ++generations_[task.id];
  queue_.push(QueueEntry{task.dueAtMs, task.id, generation});
}

bool SchedulerCore::compactQueueHeadLocked() {
  while (!queue_.empty()) {
    const QueueEntry top = queue_.top();
    const auto generationIt = generations_.find(top.id);
    if (generationIt == generations_.end() || generationIt->second != top.generation) {
      queue_.pop();
      continue;
    }
    const auto taskIt = tasksById_.find(top.id);
    if (taskIt == tasksById_.end() || taskIt->second.paused) {
      queue_.pop();
      continue;
    }
    return true;
  }
  return false;
}

std::vector<int32_t> SchedulerCore::listActiveIds() const {
  std::lock_guard<std::recursive_mutex> lock(mutex_);
  std::vector<int32_t> ids;
  ids.reserve(tasksById_.size());
  for (const auto& [id, _] : tasksById_) {
    ids.push_back(id);
  }
  std::sort(ids.begin(), ids.end());
  return ids;
}

SchedulerStats SchedulerCore::getStats() const {
  std::lock_guard<std::recursive_mutex> lock(mutex_);
  SchedulerStats out = stats_;
  out.activeCount = static_cast<int32_t>(tasksById_.size());
  return out;
}

std::string SchedulerCore::getGroupsJson() const {
  std::lock_guard<std::recursive_mutex> lock(mutex_);
  std::unordered_map<std::string, int32_t> counts;
  for (const auto& [_, t] : tasksById_) {
    counts[t.group] += 1;
  }
  std::ostringstream oss;
  oss << '{';
  bool first = true;
  for (const auto& [name, cnt] : counts) {
    if (!first) {
      oss << ',';
    }
    first = false;
    oss << jsonEscapeToken(name) << ':' << cnt;
  }
  oss << '}';
  return oss.str();
}

int64_t SchedulerCore::nextDueMs(int64_t /* nowMs */) {
  std::lock_guard<std::recursive_mutex> lock(mutex_);
  if (!compactQueueHeadLocked()) {
    return INT64_MIN;
  }
  return queue_.top().dueAtMs;
}

bool SchedulerCore::isActive(int32_t id) const {
  std::lock_guard<std::recursive_mutex> lock(mutex_);
  return tasksById_.find(id) != tasksById_.end();
}

std::string SchedulerCore::exportPersistWireJson() const {
  std::lock_guard<std::recursive_mutex> lock(mutex_);
  std::ostringstream o;
  o << "{\"version\":1,\"tasks\":[";
  bool first = true;
  for (const auto& [_, t] : tasksById_) {
    if (!first) {
      o << ',';
    }
    first = false;
    o << '{';
    o << "\"id\":" << t.id << ',';
    o << "\"dueAtMs\":" << t.dueAtMs << ',';
    o << "\"kind\":" << jsonEscapeToken(t.kind) << ',';
    o << "\"intervalMs\":" << t.intervalMs << ',';
    o << "\"group\":" << jsonEscapeToken(t.group) << ',';
    o << "\"driftPolicy\":" << jsonEscapeToken(t.driftPolicy) << ',';
    o << "\"maxRuns\":";
    if (t.maxRuns.has_value()) {
      o << t.maxRuns.value();
    } else {
      o << -1;
    }
    o << ',';
    o << "\"runCount\":" << t.runCount << ',';
    o << "\"paused\":" << (t.paused ? "true" : "false");
    o << '}';
  }
  o << "]}";
  return o.str();
}

void SchedulerCore::clearAllTasks() {
  std::lock_guard<std::recursive_mutex> lock(mutex_);
  tasksById_.clear();
  generations_.clear();
  while (!queue_.empty()) {
    queue_.pop();
  }
}

void SchedulerCore::importTaskRecord(TaskRecord task) {
  std::lock_guard<std::recursive_mutex> lock(mutex_);
  tasksById_[task.id] = task;
  const uint64_t generation = ++generations_[task.id];
  if (!task.paused) {
    queue_.push(QueueEntry{task.dueAtMs, task.id, generation});
  }
}

}  // namespace nitro_bt_scheduler
