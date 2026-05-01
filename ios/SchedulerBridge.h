#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SchedulerCppBridge : NSObject

- (void)scheduleWithId:(NSInteger)timerId
              dueAtMs:(int64_t)dueAtMs
                  kind:(NSString *)kind
            intervalMs:(int64_t)intervalMs
                 group:(NSString *)group
           driftPolicy:(NSString *)driftPolicy
               maxRuns:(NSInteger)maxRuns
          metadataJson:(NSString *)metadataJson NS_SWIFT_NAME(schedule(timerId:dueAtMs:kind:intervalMs:group:driftPolicy:maxRuns:metadataJson:));

- (void)cancelId:(NSInteger)timerId NS_SWIFT_NAME(cancel(timerId:));

- (NSInteger)pauseGroup:(NSString *)group NS_SWIFT_NAME(pause(group:));

- (NSInteger)resumeGroup:(NSString *)group nowMs:(int64_t)nowMs NS_SWIFT_NAME(resume(group:nowMs:));

- (NSInteger)cancelGroup:(NSString *)group NS_SWIFT_NAME(cancel(group:));

- (NSArray<NSNumber *> *)popDuePairsAtNowMs:(int64_t)nowMs NS_SWIFT_NAME(popDuePairs(nowMs:));

- (int64_t)nextDueMs NS_SWIFT_NAME(nextDueMs());

- (NSArray<NSNumber *> *)listActiveIds NS_SWIFT_NAME(listActiveIds());

- (NSDictionary<NSString *, NSNumber *> *)groupCountsDict NS_SWIFT_NAME(groupCounts());

- (NSDictionary<NSString *, NSNumber *> *)coreStatsDict NS_SWIFT_NAME(coreStats());

- (NSString *)groupsJson NS_SWIFT_NAME(groupsJson());

- (BOOL)isActiveTimerId:(NSInteger)timerId NS_SWIFT_NAME(isActive(timerId:));

- (NSString *)exportPersistWireJson;

- (void)clearAllTasks;

- (void)importTaskWithId:(NSInteger)timerId
              dueAtMs:(int64_t)dueAtMs
                  kind:(NSString *)kind
            intervalMs:(int64_t)intervalMs
                 group:(NSString *)group
           driftPolicy:(NSString *)driftPolicy
               maxRuns:(NSInteger)maxRuns
              runCount:(NSInteger)runCount
                paused:(BOOL)paused
          metadataJson:(NSString *)metadataJson NS_SWIFT_NAME(importTask(timerId:dueAtMs:kind:intervalMs:group:driftPolicy:maxRuns:runCount:paused:metadataJson:));

@end

NS_ASSUME_NONNULL_END
