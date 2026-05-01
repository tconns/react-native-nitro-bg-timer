package com.margelo.nitro.backgroundtimer

import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
internal object SchedulerNative {

  init {
    System.loadLibrary("NitroBackgroundTimer")
  }

  external fun nativeCreate(): Long

  external fun nativeDestroy(handle: Long)

  external fun nativeSchedule(
    handle: Long,
    id: Int,
    dueAtMs: Long,
    kind: String,
    intervalMs: Long,
    group: String,
    driftPolicy: String,
    maxRuns: Int
  )

  external fun nativeCancel(handle: Long, id: Int): Unit

  external fun nativePauseGroup(handle: Long, group: String): Int

  external fun nativeResumeGroup(handle: Long, nowMs: Long, group: String): Int

  external fun nativeCancelGroup(handle: Long, group: String): Int

  external fun nativePopDuePairs(handle: Long, nowMs: Long): LongArray

  external fun nativeNextDueMs(handle: Long, nowMs: Long): Long

  external fun nativeListActiveIds(handle: Long): IntArray

  external fun nativeGetCoreStats(handle: Long): LongArray

  external fun nativeGetGroupsJson(handle: Long): String

  external fun nativeIsActive(handle: Long, id: Int): Boolean

  external fun nativeExportPersistWireJson(handle: Long): String

  external fun nativeClearAll(handle: Long)

  external fun nativeImportTask(
    handle: Long,
    id: Int,
    dueAtMs: Long,
    kind: String,
    intervalMs: Long,
    group: String,
    driftPolicy: String,
    maxRuns: Int,
    runCount: Int,
    paused: Boolean
  )
}
