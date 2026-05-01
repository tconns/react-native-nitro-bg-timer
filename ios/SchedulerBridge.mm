#import "SchedulerBridge.h"

#import <Foundation/Foundation.h>

#include "../cpp/SchedulerCore.hpp"

@implementation SchedulerCppBridge {
  nitro_bt_scheduler::SchedulerCore *_core;
}

- (instancetype)init {
  self = [super init];
  if (self != nil) {
    _core = new nitro_bt_scheduler::SchedulerCore();
  }
  return self;
}

- (void)dealloc {
  delete _core;
  _core = nullptr;
}

- (void)scheduleWithId:(NSInteger)timerId
              dueAtMs:(int64_t)dueAtMs
                  kind:(NSString *)kind
            intervalMs:(int64_t)intervalMs
                 group:(NSString *)group
           driftPolicy:(NSString *)driftPolicy
               maxRuns:(NSInteger)maxRuns {
  nitro_bt_scheduler::TaskRecord t{};
  t.id = static_cast<int32_t>(timerId);
  t.dueAtMs = dueAtMs;
  t.kind = [kind UTF8String] ?: "";
  t.intervalMs = intervalMs;
  t.group = [group UTF8String] ?: "";
  t.driftPolicy = [driftPolicy UTF8String] ?: "";
  if (maxRuns < 0) {
    t.maxRuns = std::nullopt;
  } else {
    t.maxRuns = static_cast<int32_t>(maxRuns);
  }
  t.runCount = 0;
  t.paused = false;
  _core->schedule(t);
}

- (void)cancelId:(NSInteger)timerId {
  _core->cancel(static_cast<int32_t>(timerId));
}

- (NSInteger)pauseGroup:(NSString *)group {
  return _core->pauseGroup(std::string([group UTF8String] ?: ""));
}

- (NSInteger)resumeGroup:(NSString *)group nowMs:(int64_t)nowMs {
  return _core->resumeGroup(std::string([group UTF8String] ?: ""), nowMs);
}

- (NSInteger)cancelGroup:(NSString *)group {
  return _core->cancelGroup(std::string([group UTF8String] ?: ""));
}

- (NSArray<NSNumber *> *)popDuePairsAtNowMs:(int64_t)nowMs {
  const auto fired = _core->popDue(nowMs);
  NSMutableArray<NSNumber *> *out =
      [NSMutableArray arrayWithCapacity:fired.size() * 2];
  for (const auto &record : fired) {
    [out addObject:@(record.id)];
    [out addObject:@(record.dueAtMs)];
  }
  return out;
}

- (int64_t)nextDueMs {
  return _core->nextDueMs(0);
}

- (NSArray<NSNumber *> *)listActiveIds {
  const auto ids = _core->listActiveIds();
  NSMutableArray *out = [NSMutableArray arrayWithCapacity:ids.size()];
  for (int32_t raw : ids) {
    [out addObject:@(raw)];
  }
  return out;
}

- (NSDictionary<NSString *, NSNumber *> *)groupCountsDict {
  const std::string json = _core->getGroupsJson();
  NSString *ns = [NSString stringWithUTF8String:json.c_str()];
  NSData *data = [ns dataUsingEncoding:NSUTF8StringEncoding];
  if (data.length == 0) {
    return @{};
  }
  id obj =
      [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if ([obj isKindOfClass:[NSDictionary class]]) {
    return (NSDictionary *)obj;
  }
  return @{};
}

- (NSString *)groupsJson {
  const std::string j = _core->getGroupsJson();
  return [NSString stringWithUTF8String:j.c_str()];
}

- (NSDictionary<NSString *, NSNumber *> *)coreStatsDict {
  const auto stats = _core->getStats();
  return @{
    @"activeCount" : @(stats.activeCount),
    @"callbackCount" : @(stats.callbackCount),
    @"missedCount" : @(stats.missedCount),
    @"wakeupCount" : @(stats.wakeupCount),
  };
}

- (BOOL)isActiveTimerId:(NSInteger)timerId {
  return _core->isActive(static_cast<int32_t>(timerId));
}

- (NSString *)exportPersistWireJson {
  const std::string j = _core->exportPersistWireJson();
  return [NSString stringWithUTF8String:j.c_str()];
}

- (void)clearAllTasks {
  _core->clearAllTasks();
}

- (void)importTaskWithId:(NSInteger)timerId
              dueAtMs:(int64_t)dueAtMs
                  kind:(NSString *)kind
            intervalMs:(int64_t)intervalMs
                 group:(NSString *)group
           driftPolicy:(NSString *)driftPolicy
               maxRuns:(NSInteger)maxRuns
              runCount:(NSInteger)runCount
                paused:(BOOL)paused {
  nitro_bt_scheduler::TaskRecord t{};
  t.id = static_cast<int32_t>(timerId);
  t.dueAtMs = dueAtMs;
  t.kind = [kind UTF8String] ?: "";
  t.intervalMs = intervalMs;
  t.group = [group UTF8String] ?: "";
  t.driftPolicy = [driftPolicy UTF8String] ?: "";
  if (maxRuns < 0) {
    t.maxRuns = std::nullopt;
  } else {
    t.maxRuns = static_cast<int32_t>(maxRuns);
  }
  t.runCount = static_cast<int32_t>(runCount);
  t.paused = paused ? true : false;
  _core->importTaskRecord(t);
}

@end
