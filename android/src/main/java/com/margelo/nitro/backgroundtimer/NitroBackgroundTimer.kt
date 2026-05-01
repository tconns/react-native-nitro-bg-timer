package com.margelo.nitro.backgroundtimer

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import org.json.JSONObject
import java.util.PriorityQueue
import kotlin.math.roundToLong

@DoNotStrip
class NitroBackgroundTimer : HybridNitroBackgroundTimerSpec() {
  private val context = NitroModules.applicationContext
    ?: throw IllegalStateException("NitroModules.applicationContext is null")
  private val handler = Handler(Looper.getMainLooper())
  private val powerManager = context.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager

  @SuppressLint("InvalidWakeLockTag")
  private val wakeLock: PowerManager.WakeLock =
    powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NitroBackgroundTimer")

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
    val group: String = DEFAULT_GROUP
  )

  private val tasksById = HashMap<Int, ScheduledTask>()
  private val queue = PriorityQueue<ScheduledTask>(compareBy { it.nextRunAtMs })
  private var tickScheduled = false
  private var callbackCount = 0L
  private var missedCount = 0L
  private var wakeupCount = 0L
  private var lateDispatchCount = 0L
  private var latenessTotalMs = 0L
  private var p95LatenessMs = 0L
  private val latenessSamples = ArrayDeque<Long>()
  private val stateLock = Any()

  private val tickRunnable = Runnable {
    synchronized(stateLock) {
      tickScheduled = false
    }
    runDueTasks()
  }

  companion object {
    private const val DEFAULT_GROUP = "default"
    private const val LATENESS_SAMPLE_WINDOW = 256
  }

  @SuppressLint("WakelockTimeout")
  private fun acquireWakeLock() {
    synchronized(stateLock) {
      if (!wakeLock.isHeld) {
        wakeLock.acquire()
      }
    }
  }

  private fun releaseWakeLockIfNeeded() {
    synchronized(stateLock) {
      if (tasksById.isEmpty() && wakeLock.isHeld) {
        wakeLock.release()
      }
    }
  }

  private fun compactQueueLocked() {
    while (queue.isNotEmpty()) {
      val top = queue.peek()
      val liveTask = tasksById[top.id]
      if (liveTask == null || liveTask !== top || top.paused) {
        queue.poll()
      } else {
        return
      }
    }
  }

  private fun scheduleNextTickLocked() {
    compactQueueLocked()
    if (queue.isEmpty()) {
      handler.removeCallbacks(tickRunnable)
      tickScheduled = false
      releaseWakeLockIfNeeded()
      return
    }
    val next = queue.peek()
    val delay = (next.nextRunAtMs - System.currentTimeMillis()).coerceAtLeast(0L)
    handler.removeCallbacks(tickRunnable)
    handler.postDelayed(tickRunnable, delay)
    tickScheduled = true
  }

  private fun runDueTasks() {
    val now = System.currentTimeMillis()
    val due = ArrayList<ScheduledTask>()

    synchronized(stateLock) {
      compactQueueLocked()
      while (queue.isNotEmpty()) {
        val top = queue.peek()
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
        Log.e("NitroBackgroundTimer", "Callback error for timer ${task.id}: ${e.message}", e)
      }

      synchronized(stateLock) {
        val active = tasksById[task.id]
        if (active != null && active === task) {
          active.runCount += 1
          if (active.mode == "interval" && (active.maxRuns == null || active.runCount < active.maxRuns)) {
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
      scheduleNextTickLocked()
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
    val sorted = latenessSamples.toList().sorted()
    if (sorted.isNotEmpty()) {
      val index = ((sorted.size - 1) * 0.95).roundToLong().toInt().coerceIn(0, sorted.size - 1)
      p95LatenessMs = sorted[index]
    }
  }

  override fun schedule(
    id: Double,
    delayMs: Double,
    kind: String,
    intervalMs: Double,
    group: String,
    driftPolicy: String,
    maxRuns: Double,
    callback: (Double) -> Unit
  ): Double {
    val intId = id.toInt()
    cancel(id)
    val normalizedKind = if (kind == "interval") "interval" else "timeout"
    val normalizedGroup = group.ifBlank { DEFAULT_GROUP }
    val normalizedMaxRuns = if (maxRuns <= 0.0) null else maxRuns.toInt()
    val normalizedIntervalMs = intervalMs.toLong().coerceAtLeast(1L)

    acquireWakeLock()

    synchronized(stateLock) {
      val task = ScheduledTask(
        id = intId,
        callback = callback,
        nextRunAtMs = System.currentTimeMillis() + delayMs.toLong().coerceAtLeast(0L),
        mode = normalizedKind,
        intervalMs = normalizedIntervalMs,
        driftPolicy = driftPolicy,
        maxRuns = normalizedMaxRuns,
        group = normalizedGroup
      )
      tasksById[intId] = task
      queue.add(task)
      scheduleNextTickLocked()
    }
    return id
  }

  override fun cancel(id: Double) {
    val intId = id.toInt()
    synchronized(stateLock) {
      tasksById.remove(intId)
      scheduleNextTickLocked()
    }
    releaseWakeLockIfNeeded()
  }

  override fun pauseGroup(group: String): Double {
    synchronized(stateLock) {
      var affected = 0
      for (task in tasksById.values) {
        if (task.group == group && !task.paused) {
          task.paused = true
          affected += 1
        }
      }
      scheduleNextTickLocked()
      return affected.toDouble()
    }
  }

  override fun resumeGroup(group: String): Double {
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
      scheduleNextTickLocked()
      return affected.toDouble()
    }
  }

  override fun cancelGroup(group: String): Double {
    synchronized(stateLock) {
      val ids = tasksById.values.filter { it.group == group }.map { it.id }
      for (id in ids) {
        tasksById.remove(id)
      }
      scheduleNextTickLocked()
      return ids.size.toDouble()
    }
  }

  override fun listActiveTimerIds(): DoubleArray {
    synchronized(stateLock) {
      return tasksById.keys.sorted().map { it.toDouble() }.toDoubleArray()
    }
  }

  override fun getStatsJson(): String {
    synchronized(stateLock) {
      val groups = JSONObject()
      val grouped = tasksById.values.groupBy { it.group }
      for ((group, groupTasks) in grouped) {
        groups.put(group, groupTasks.size)
      }
      val json = JSONObject()
      json.put("activeCount", tasksById.size)
      json.put("callbackCount", callbackCount)
      json.put("missedCount", missedCount)
      json.put("wakeupCount", wakeupCount)
      json.put("lateDispatchCount", lateDispatchCount)
      json.put("avgLatenessMs", if (lateDispatchCount == 0L) 0 else latenessTotalMs / lateDispatchCount)
      json.put("p95LatenessMs", p95LatenessMs)
      json.put("groups", groups)
      return json.toString()
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
      callback = callback
    )
  }

  override fun clearInterval(id: Double) {
    cancel(id)
  }

  override fun dispose() {
    synchronized(stateLock) {
      tasksById.clear()
      queue.clear()
      handler.removeCallbacks(tickRunnable)
      tickScheduled = false
      if (wakeLock.isHeld) {
        wakeLock.release()
      }
    }
  }
}
