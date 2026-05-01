package com.margelo.nitro.backgroundtimer

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import org.json.JSONArray
import org.json.JSONObject
import java.util.PriorityQueue
import kotlin.math.roundToLong

@DoNotStrip
class NitroBackgroundTimer : HybridNitroBackgroundTimerSpec() {

  private val context = NitroModules.applicationContext
    ?: throw IllegalStateException("NitroModules.applicationContext is null")

  private val handler = Handler(Looper.getMainLooper())
  private val powerManager =
    context.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager

  @SuppressLint("InvalidWakeLockTag")
  private val wakeLock: PowerManager.WakeLock =
    powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NitroBackgroundTimer")

  private val useCpp = BuildConfig.USE_CPP_SCHEDULER

  companion object {
    private const val DEFAULT_GROUP = "default"
    private const val LATENESS_SAMPLE_WINDOW = 256
    private const val LATENESS_P95_RECALC_INTERVAL = 16
    private const val SCHED_MAX_RUN_UNLIMITED = -1
  }

  private data class ScheduledTask(
    val id: Int,
    val callback: (Double) -> Unit,
    var nextRunAtMs: Long,
    val mode: String,
    val intervalMs: Long,
    val driftPolicy: String,
    val maxRuns: Int?,
    var runCount: Int = 0,
    var paused: Boolean = false,
    val group: String = DEFAULT_GROUP,
    val correlationToken: Long = 0L,
    val retryMaxAttempts: Int = 0,
    val retryInitialBackoffMs: Long = 0L,
    val cancellationToken: String = "",
    val tagMask: Long = 0L,
    val policyProfile: String = "balanced"
  )

  private val tasksById = HashMap<Int, ScheduledTask>()
  private val queue = PriorityQueue<ScheduledTask>(compareBy { it.nextRunAtMs })
  private var tickKotlinScheduled = false
  private lateinit var tickKotlinRunnable: Runnable
  private val stateLock = Any()

  private var callbackCount = 0L
  private var missedCount = 0L
  private var wakeupCount = 0L

  private val cppSync = Any()
  private var cppHandle: Long = 0
  private val cppCallbacks = HashMap<Int, (Double) -> Unit>()
  private lateinit var cppTickRunnable: Runnable
  private var tickCppScheduled = false

  private var lateDispatchCount = 0L
  private var latenessTotalMs = 0L
  private var p95LatenessMs = 0L
  private val latenessSamples = ArrayDeque<Long>()
  private var latenessDirtyCount = 0

  init {
    tickKotlinRunnable = Runnable {
      synchronized(stateLock) {
        tickKotlinScheduled = false
      }
      runDueTasksKotlin()
    }

    cppTickRunnable = Runnable {
      synchronized(cppSync) {
        tickCppScheduled = false
      }
      runDueTasksCpp()
    }

    if (useCpp) {
      cppHandle = SchedulerNative.nativeCreate()
    }
  }

  @SuppressLint("WakelockTimeout")
  private fun acquireWakeLockIfNeededLocked() {
    if (!wakeLock.isHeld) {
      wakeLock.acquire()
    }
  }

  private fun releaseWakeLockIfNeeded() {
    if (useCpp) {
      synchronized(cppSync) {
        if (cppHandle == 0L) {
          if (wakeLock.isHeld) wakeLock.release()
          return
        }
        val ids = SchedulerNative.nativeListActiveIds(cppHandle)
        if (ids.isEmpty() && wakeLock.isHeld) {
          wakeLock.release()
        }
      }
    } else {
      synchronized(stateLock) {
        if (tasksById.isEmpty() && wakeLock.isHeld) {
          wakeLock.release()
        }
      }
    }
  }

  private fun recordLateness(latenessMs: Long) {
    if (latenessMs <= 0L) return
    lateDispatchCount += 1
    latenessTotalMs += latenessMs
    latenessSamples.addLast(latenessMs)
    if (latenessSamples.size > LATENESS_SAMPLE_WINDOW) {
      latenessSamples.removeFirst()
    }
    latenessDirtyCount += 1
    if (latenessDirtyCount < LATENESS_P95_RECALC_INTERVAL) {
      return
    }
    latenessDirtyCount = 0
    val sorted = latenessSamples.toList().sorted()
    if (sorted.isNotEmpty()) {
      val index = ((sorted.size - 1) * 0.95).roundToLong().toInt().coerceIn(0, sorted.size - 1)
      p95LatenessMs = sorted[index]
    }
  }

  private fun compactQueueLockedKotlin() {
    while (queue.isNotEmpty()) {
      val top = queue.peek() ?: break
      val liveTask = tasksById[top.id]
      if (liveTask == null || liveTask !== top || top.paused) {
        queue.poll()
      } else {
        return
      }
    }
  }

  private fun scheduleNextTickKotlinLocked() {
    compactQueueLockedKotlin()
    if (queue.isEmpty()) {
      handler.removeCallbacks(tickKotlinRunnable)
      tickKotlinScheduled = false
      releaseWakeLockIfNeeded()
      return
    }
    val next = queue.peek() ?: return
    val delay = (next.nextRunAtMs - System.currentTimeMillis()).coerceAtLeast(0L)
    handler.removeCallbacks(tickKotlinRunnable)
    handler.postDelayed(tickKotlinRunnable, delay)
    tickKotlinScheduled = true
  }

  private fun runDueTasksKotlin() {
    if (useCpp) return
    val now = System.currentTimeMillis()
    val due = ArrayList<ScheduledTask>()

    synchronized(stateLock) {
      compactQueueLockedKotlin()
      while (queue.isNotEmpty()) {
        val top = queue.peek() ?: break
        if (top.nextRunAtMs > now) {
          break
        }
        queue.poll()
        val current = tasksById[top.id]
        if (current != null && current === top && !current.paused) {
          recordLateness(now - top.nextRunAtMs)
          due.add(current)
        }
      }
      if (due.isNotEmpty()) {
        wakeupCount += 1
      }
    }

    for (task in due) {
      try {
        task.callback(task.id.toDouble())
        callbackCount += 1
      } catch (e: Exception) {
        Log.e(
          "NitroBackgroundTimer",
          "Callback error for timer ${task.id}: ${e.message}",
          e
        )
      }

      synchronized(stateLock) {
        val active = tasksById[task.id]
        if (active != null && active === task) {
          active.runCount += 1
          if (
            active.mode == "interval" &&
            (active.maxRuns == null || active.runCount < active.maxRuns)
          ) {
            val intervalMs = active.intervalMs.coerceAtLeast(1L)
            val targetNext = when (active.driftPolicy) {
              "catchUp" -> active.nextRunAtMs + intervalMs
              "skipLate" -> now + intervalMs
              else -> maxOf(active.nextRunAtMs + intervalMs, now + 1L)
            }
            if (targetNext < now) {
              missedCount += 1
            }
            active.nextRunAtMs = targetNext
            queue.add(active)
          } else {
            tasksById.remove(active.id)
          }
        }
      }
    }

    synchronized(stateLock) {
      scheduleNextTickKotlinLocked()
    }
    releaseWakeLockIfNeeded()
  }

  private fun scheduleNextTickCppLocked() {
    if (cppHandle == 0L) {
      handler.removeCallbacks(cppTickRunnable)
      tickCppScheduled = false
      releaseWakeLockIfNeeded()
      return
    }
    val nextDue = SchedulerNative.nativeNextDueMs(cppHandle, System.currentTimeMillis())
    if (nextDue == Long.MIN_VALUE) {
      handler.removeCallbacks(cppTickRunnable)
      tickCppScheduled = false
      releaseWakeLockIfNeeded()
      return
    }
    val delay = (nextDue - System.currentTimeMillis()).coerceAtLeast(0L)
    handler.removeCallbacks(cppTickRunnable)
    handler.postDelayed(cppTickRunnable, delay)
    tickCppScheduled = true
  }

  private fun runDueTasksCpp() {
    if (!useCpp || cppHandle == 0L) return
    val now = System.currentTimeMillis()
    val pairs = synchronized(cppSync) {
      SchedulerNative.nativePopDuePairs(cppHandle, now)
    }
    var idx = 0
    while (idx + 1 < pairs.size) {
      val id = pairs[idx].toInt()
      val scheduledDue = pairs[idx + 1]
      recordLateness(now - scheduledDue)
      val cb = synchronized(cppSync) {
        cppCallbacks[id]
      }
      try {
        cb?.invoke(id.toDouble())
      } catch (e: Exception) {
        Log.e("NitroBackgroundTimer", "Callback error for timer $id: ${e.message}", e)
      }
      synchronized(cppSync) {
        if (cppHandle != 0L && !SchedulerNative.nativeIsActive(cppHandle, id)) {
          cppCallbacks.remove(id)
        }
      }
      idx += 2
    }

    synchronized(cppSync) {
      scheduleNextTickCppLocked()
    }
    releaseWakeLockIfNeeded()
  }

  private fun encodeMetadataJson(
    correlationToken: Long,
    retryMaxAttempts: Int,
    retryInitialBackoffMs: Long,
    cancellationToken: String,
    tagMask: Long,
    policyProfile: String
  ): String =
    JSONObject().apply {
      put("correlationToken", correlationToken)
      put("retryMaxAttempts", retryMaxAttempts)
      put("retryInitialBackoffMs", retryInitialBackoffMs)
      put("cancellationToken", cancellationToken)
      put("tagMask", tagMask)
      put("policyProfile", policyProfile)
    }.toString()

  private fun applyPolicyProfile(profile: String, retryMax: Int, retryBackoffMs: Long): Pair<Int, Long> =
    when (profile) {
      "batterySaver" -> Pair(retryMax.coerceAtMost(2), retryBackoffMs.coerceAtLeast(5000L))
      "latencyFirst" -> Pair(retryMax.coerceAtLeast(1), retryBackoffMs.coerceAtMost(250L))
      else -> Pair(retryMax, retryBackoffMs)
    }

  override fun schedule(
    id: Double,
    delayMs: Double,
    kind: String,
    intervalMs: Double,
    group: String,
    driftPolicy: String,
    maxRuns: Double,
    correlationToken: Double,
    retryMaxAttempts: Double,
    retryInitialBackoffMs: Double,
    cancellationToken: String,
    tagMask: Double,
    policyProfile: String,
    callback: (Double) -> Unit
  ): Double {
    val intId = id.toInt()
    cancel(id)
    val normalizedKind = if (kind == "interval") "interval" else "timeout"
    val normalizedGroup = group.ifBlank { DEFAULT_GROUP }
    val mrInt = if (maxRuns <= 0.0) SCHED_MAX_RUN_UNLIMITED else maxRuns.toInt()
    val normalizedIntervalMs = intervalMs.toLong().coerceAtLeast(1L)
    val normalizedCorrelationToken = correlationToken.toLong()
    val normalizedRetryMaxAttemptsRaw = retryMaxAttempts.toInt().coerceAtLeast(0)
    val normalizedRetryInitialBackoffMsRaw = retryInitialBackoffMs.toLong().coerceAtLeast(0L)
    val normalizedCancellationToken = cancellationToken
    val normalizedTagMask = tagMask.toLong()
    val normalizedPolicyProfile = if (policyProfile.isBlank()) "balanced" else policyProfile
    val (normalizedRetryMaxAttempts, normalizedRetryInitialBackoffMs) = applyPolicyProfile(
      normalizedPolicyProfile,
      normalizedRetryMaxAttemptsRaw,
      normalizedRetryInitialBackoffMsRaw
    )

    if (useCpp) {
      synchronized(cppSync) {
        acquireWakeLockIfNeededLocked()
        cppCallbacks[intId] = callback
        val dueAt = System.currentTimeMillis() + delayMs.toLong().coerceAtLeast(0L)
        val metadataJson = encodeMetadataJson(
          normalizedCorrelationToken,
          normalizedRetryMaxAttempts,
          normalizedRetryInitialBackoffMs,
          normalizedCancellationToken,
          normalizedTagMask,
          normalizedPolicyProfile
        )
        SchedulerNative.nativeSchedule(
          cppHandle,
          intId,
          dueAt,
          normalizedKind,
          normalizedIntervalMs,
          normalizedGroup,
          driftPolicy,
          mrInt,
          metadataJson
        )
        scheduleNextTickCppLocked()
      }
      return id
    }

    synchronized(stateLock) {
      acquireWakeLockIfNeededLocked()
      val task = ScheduledTask(
        id = intId,
        callback = callback,
        nextRunAtMs = System.currentTimeMillis() + delayMs.toLong().coerceAtLeast(0L),
        mode = normalizedKind,
        intervalMs = normalizedIntervalMs,
        driftPolicy = driftPolicy,
        maxRuns = if (maxRuns <= 0.0) null else maxRuns.toInt(),
          group = normalizedGroup,
          correlationToken = normalizedCorrelationToken,
          retryMaxAttempts = normalizedRetryMaxAttempts,
          retryInitialBackoffMs = normalizedRetryInitialBackoffMs,
          cancellationToken = normalizedCancellationToken,
          tagMask = normalizedTagMask,
          policyProfile = normalizedPolicyProfile
      )
      tasksById[intId] = task
      queue.add(task)
      scheduleNextTickKotlinLocked()
    }
    return id
  }

  override fun cancel(id: Double) {
    val intId = id.toInt()
    if (useCpp) {
      synchronized(cppSync) {
        if (cppHandle != 0L) {
          SchedulerNative.nativeCancel(cppHandle, intId)
        }
        cppCallbacks.remove(intId)
        scheduleNextTickCppLocked()
      }
    } else {
      synchronized(stateLock) {
        tasksById.remove(intId)
        scheduleNextTickKotlinLocked()
      }
    }
    releaseWakeLockIfNeeded()
  }

  override fun pauseGroup(group: String): Double =
    if (useCpp) {
      synchronized(cppSync) {
        val n =
          if (
            cppHandle != 0L
          )
            SchedulerNative.nativePauseGroup(
              cppHandle,
              group,
            )
          else 0
        scheduleNextTickCppLocked()
        n.toDouble()
      }
    } else {
      synchronized(stateLock) {
        var affected = 0
        for (task in tasksById.values) {
          if (task.group == group && !task.paused) {
            task.paused = true
            affected += 1
          }
        }
        scheduleNextTickKotlinLocked()
        affected.toDouble()
      }
    }

  override fun resumeGroup(group: String): Double =
    if (useCpp) {
      synchronized(cppSync) {
        val now = System.currentTimeMillis()
        val n =
          if (
            cppHandle != 0L
          )
            SchedulerNative.nativeResumeGroup(
              cppHandle,
              now,
              group,
            )
          else 0
        scheduleNextTickCppLocked()
        n.toDouble()
      }
    } else {
      synchronized(stateLock) {
        var affected = 0
        val now = System.currentTimeMillis()
        for (task in tasksById.values) {
          if (task.group == group && task.paused) {
            task.paused = false
            task.nextRunAtMs = maxOf(task.nextRunAtMs, now + 1L)
            queue.add(task)
            affected += 1
          }
        }
        scheduleNextTickKotlinLocked()
        affected.toDouble()
      }
    }

  override fun cancelGroup(group: String): Double =
    if (useCpp) {
      synchronized(cppSync) {
        val removed =
          if (
            cppHandle != 0L
          )
            SchedulerNative.nativeCancelGroup(
              cppHandle,
              group,
            )
          else 0
        if (cppHandle != 0L) {
          val keep = SchedulerNative.nativeListActiveIds(cppHandle).toSet()
          cppCallbacks.keys.removeAll { it !in keep }
        }
        scheduleNextTickCppLocked()
        removed.toDouble()
      }
    } else {
      synchronized(stateLock) {
        val ids = tasksById.values.filter { it.group == group }.map { it.id }
        for (subId in ids) {
          tasksById.remove(subId)
        }
        scheduleNextTickKotlinLocked()
        ids.size.toDouble()
      }
    }

  override fun listActiveTimerIds(): DoubleArray =
    if (useCpp) {
      synchronized(cppSync) {
        if (cppHandle == 0L) return DoubleArray(0)
        SchedulerNative.nativeListActiveIds(cppHandle)
          .sorted()
          .map { it.toDouble() }
          .toDoubleArray()
      }
    } else {
      synchronized(stateLock) {
        tasksById.keys.sorted().map { it.toDouble() }.toDoubleArray()
      }
    }

  override fun getPersistWireJson(): String =
    if (useCpp) {
      synchronized(cppSync) {
        if (cppHandle == 0L) {
          return JSONObject().apply {
            put("version", 1)
            put("tasks", JSONArray())
          }.toString()
        }
        SchedulerNative.nativeExportPersistWireJson(cppHandle)
      }
    } else {
      synchronized(stateLock) {
        val arr = JSONArray()
        for ((id, t) in tasksById) {
          arr.put(
            JSONObject().apply {
              put("id", id)
              put("dueAtMs", t.nextRunAtMs)
              put("kind", t.mode)
              put("intervalMs", t.intervalMs)
              put("group", t.group)
              put("driftPolicy", t.driftPolicy)
              put("maxRuns", t.maxRuns ?: -1)
              put("runCount", t.runCount)
              put("paused", t.paused)
              put(
                "metadataJson",
                encodeMetadataJson(
                  t.correlationToken,
                  t.retryMaxAttempts,
                  t.retryInitialBackoffMs,
                  t.cancellationToken,
                  t.tagMask,
                  t.policyProfile
                )
              )
            }
          )
        }
        JSONObject().apply {
          put("version", 1)
          put("tasks", arr)
        }.toString()
      }
    }

  override fun restorePersistWireJson(wireJson: String) {
    if (useCpp) {
      synchronized(cppSync) {
        if (cppHandle == 0L) return
        val root = JSONObject(wireJson)
        if (root.optInt("version") != 1) return
        cppCallbacks.clear()
        SchedulerNative.nativeClearAll(cppHandle)
        val tasks = root.getJSONArray("tasks")
        for (i in 0 until tasks.length()) {
          val o = tasks.getJSONObject(i)
          SchedulerNative.nativeImportTask(
            cppHandle,
            o.getInt("id"),
            o.getLong("dueAtMs"),
            o.getString("kind"),
            o.getLong("intervalMs"),
            o.optString("group", DEFAULT_GROUP),
            o.optString("driftPolicy", "coalesce"),
            o.optInt("maxRuns", SCHED_MAX_RUN_UNLIMITED),
            o.optInt("runCount", 0),
            o.optBoolean("paused", false),
            o.optString("metadataJson", ""),
          )
        }
        scheduleNextTickCppLocked()
      }
      releaseWakeLockIfNeeded()
    } else {
      Log.w(
        "NitroBackgroundTimer",
        "restorePersistWireJson skipped: native persistence restore requires USE_CPP_SCHEDULER=true"
      )
    }
  }

  override fun getStatsJson(): String =
    if (useCpp) {
      synchronized(cppSync) {
        val st =
          if (
            cppHandle != 0L
          )
            SchedulerNative.nativeGetCoreStats(
              cppHandle,
            )
          else longArrayOf(0, 0, 0, 0)
        val groupsJsonRaw =
          if (
            cppHandle != 0L
          )
            SchedulerNative.nativeGetGroupsJson(
              cppHandle,
            )
          else "{}"
        val groupsParsed = JSONObject(groupsJsonRaw)
        JSONObject().apply {
          put("activeCount", if (st.isNotEmpty()) st[0].toInt() else 0)
          put("callbackCount", if (st.size > 1) st[1] else 0L)
          put("missedCount", if (st.size > 2) st[2] else 0L)
          put("wakeupCount", if (st.size > 3) st[3] else 0L)
          put("lateDispatchCount", lateDispatchCount)
          put(
            "avgLatenessMs",
            if (lateDispatchCount == 0L) 0 else latenessTotalMs / lateDispatchCount
          )
          put("p95LatenessMs", p95LatenessMs)
          put("groups", groupsParsed)
        }.toString()
      }
    } else {
      synchronized(stateLock) {
        val groups = JSONObject()
        for ((gName, lst) in tasksById.values.groupBy { it.group }) {
          groups.put(gName, lst.size)
        }
        JSONObject().apply {
          put("activeCount", tasksById.size)
          put("callbackCount", callbackCount)
          put("missedCount", missedCount)
          put("wakeupCount", wakeupCount)
          put("lateDispatchCount", lateDispatchCount)
          put(
            "avgLatenessMs",
            if (lateDispatchCount == 0L) 0 else latenessTotalMs / lateDispatchCount
          )
          put("p95LatenessMs", p95LatenessMs)
          put("groups", groups)
        }.toString()
      }
    }

  override fun setTimeout(id: Double, duration: Double, callback: (Double) -> Unit): Double {
    return schedule(
      id = id,
      delayMs = duration,
      kind = "timeout",
      intervalMs = duration,
      group = DEFAULT_GROUP,
      driftPolicy = "coalesce",
      maxRuns = 1.0,
      correlationToken = 0.0,
      retryMaxAttempts = 0.0,
      retryInitialBackoffMs = 0.0,
      cancellationToken = "",
      tagMask = 0.0,
      policyProfile = "balanced",
      callback = callback
    )
  }

  override fun clearTimeout(id: Double) {
    cancel(id)
  }

  override fun setInterval(id: Double, interval: Double, callback: (Double) -> Unit): Double {
    return schedule(
      id = id,
      delayMs = interval,
      kind = "interval",
      intervalMs = interval,
      group = DEFAULT_GROUP,
      driftPolicy = "coalesce",
      maxRuns = 0.0,
      correlationToken = 0.0,
      retryMaxAttempts = 0.0,
      retryInitialBackoffMs = 0.0,
      cancellationToken = "",
      tagMask = 0.0,
      policyProfile = "balanced",
      callback = callback
    )
  }

  override fun clearInterval(id: Double) {
    cancel(id)
  }

  override fun dispose() {
    handler.removeCallbacks(tickKotlinRunnable)
    handler.removeCallbacks(cppTickRunnable)
    synchronized(cppSync) {
      if (cppHandle != 0L) {
        SchedulerNative.nativeDestroy(cppHandle)
        cppHandle = 0L
      }
      cppCallbacks.clear()
    }
    synchronized(stateLock) {
      tasksById.clear()
      queue.clear()
      if (wakeLock.isHeld) {
        wakeLock.release()
      }
    }
  }
}
