#import <XCTest/XCTest.h>

#import "SchedulerBridge.h"

@interface SchedulerBridgeRuntimeTests : XCTestCase
@end

@implementation SchedulerBridgeRuntimeTests

- (void)testScheduleAndPopDue {
  SchedulerCppBridge *bridge = [SchedulerCppBridge new];
  int64_t nowMs = (int64_t)([[NSDate date] timeIntervalSince1970] * 1000.0);
  [bridge scheduleWithId:77
                dueAtMs:nowMs + 5
                    kind:@"timeout"
              intervalMs:1
                   group:@"runtime"
             driftPolicy:@"coalesce"
                 maxRuns:1
            metadataJson:@"{}"];

  NSArray<NSNumber *> *pairs = [bridge popDuePairsAtNowMs:nowMs + 50];
  XCTAssertTrue(pairs.count >= 2);
  XCTAssertEqualObjects(pairs.firstObject, @77);
}

@end
