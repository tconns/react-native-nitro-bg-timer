package com.margelo.nitro.backgroundtimer

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SchedulerNativeRuntimeTest {

  @Test
  fun scheduleAndPopDueFromNativeCore() {
    val handle = SchedulerNative.nativeCreate()
    try {
      val now = System.currentTimeMillis()
      SchedulerNative.nativeSchedule(
        handle,
        42,
        now + 5L,
        "timeout",
        1L,
        "runtime",
        "coalesce",
        1
      )

      val pairs = SchedulerNative.nativePopDuePairs(handle, now + 50L)
      assertTrue("expected at least one id/due pair", pairs.size >= 2)
      assertTrue("expected first id to be 42", pairs[0] == 42L)
    } finally {
      SchedulerNative.nativeDestroy(handle)
    }
  }
}
