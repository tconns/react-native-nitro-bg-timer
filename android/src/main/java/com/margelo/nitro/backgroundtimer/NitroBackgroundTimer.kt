package com.margelo.nitro.backgroundtimer

import android.annotation.SuppressLint
import com.facebook.proguard.annotations.DoNotStrip
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import com.margelo.nitro.NitroModules

@DoNotStrip
class NitroBackgroundTimer : HybridNitroBackgroundTimerSpec() {
  private val context = NitroModules.applicationContext
    ?: throw IllegalStateException("NitroModules.applicationContext is null")

  private val handler = Handler(Looper.getMainLooper())
  private val powerManager = context.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
  @SuppressLint("InvalidWakeLockTag")
  private val wakeLock: PowerManager.WakeLock =
    powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NitroBackgroundTimer")

  private val timeoutRunnables = HashMap<Int, Runnable>()
  private val intervalRunnables = HashMap<Int, Runnable>()

  // --- WakeLock helpers ---
  @SuppressLint("WakelockTimeout")
  private fun acquireWakeLock() {
    if (!wakeLock.isHeld) {
      wakeLock.acquire()
    }
  }

  private fun releaseWakeLockIfNeeded() {
    if (timeoutRunnables.isEmpty() && intervalRunnables.isEmpty() && wakeLock.isHeld) {
      wakeLock.release()
    }
  }

  // --- Timeout ---
  override fun setTimeout(id: Double, duration: Double, callback: (Double) -> Unit): Double {
    val intId = id.toInt()
    clearTimeout(id)

    acquireWakeLock()
    val runnable = Runnable {
      try {
        callback(id)
      } catch (e: Exception) {
        Log.e("NitroBackgroundTimer", "Callback error in setTimeout($id): ${e.message}", e)
      }
      timeoutRunnables.remove(intId)
      releaseWakeLockIfNeeded()
    }

    timeoutRunnables[intId] = runnable
    handler.postDelayed(runnable, duration.toLong())
    return id
  }

  override fun clearTimeout(id: Double) {
    val intId = id.toInt()
    timeoutRunnables[intId]?.let { handler.removeCallbacks(it) }
    timeoutRunnables.remove(intId)
    releaseWakeLockIfNeeded()
  }

  // --- Interval ---
  override fun setInterval(id: Double, interval: Double, callback: (Double) -> Unit): Double {
    val intId = id.toInt()
    clearInterval(id)

    acquireWakeLock()
    val runnable = object : Runnable {
      override fun run() {
        try {
          callback(id)
        } catch (e: Exception) {
          Log.e("NitroBackgroundTimer", "Callback error in setInterval($id): ${e.message}", e)
        }
        handler.postDelayed(this, interval.toLong())
      }
    }

    intervalRunnables[intId] = runnable
    handler.postDelayed(runnable, interval.toLong())
    return id
  }

  override fun clearInterval(id: Double) {
    val intId = id.toInt()
    intervalRunnables[intId]?.let { handler.removeCallbacks(it) }
    intervalRunnables.remove(intId)
    releaseWakeLockIfNeeded()
  }

  // --- Cleanup ---
  protected fun finalize() {
    timeoutRunnables.values.forEach { handler.removeCallbacks(it) }
    intervalRunnables.values.forEach { handler.removeCallbacks(it) }
    timeoutRunnables.clear()
    intervalRunnables.clear()
    if (wakeLock.isHeld) wakeLock.release()
  }
}
