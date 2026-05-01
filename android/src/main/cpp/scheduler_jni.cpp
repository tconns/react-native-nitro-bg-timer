#include <jni.h>
#include <string>

#include "SchedulerCore.hpp"

using nitro_bt_scheduler::SchedulerCore;
using nitro_bt_scheduler::SchedulerStats;
using nitro_bt_scheduler::TaskRecord;

namespace {

std::string jstringToUtf(JNIEnv* env, jstring js) {
  if (js == nullptr) {
    return {};
  }
  const char* c = env->GetStringUTFChars(js, nullptr);
  if (c == nullptr) {
    return {};
  }
  std::string out(c);
  env->ReleaseStringUTFChars(js, c);
  return out;
}

}  // namespace

extern "C" JNIEXPORT jlong JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeCreate(
    JNIEnv* env,
    jclass) {
  (void)env;
  return reinterpret_cast<jlong>(new SchedulerCore());
}

extern "C" JNIEXPORT void JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeDestroy(
    JNIEnv* env,
    jclass,
    jlong handle) {
  (void)env;
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  delete core;
}

extern "C" JNIEXPORT void JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeSchedule(
    JNIEnv* env,
    jclass,
    jlong handle,
    jint id,
    jlong dueAtMs,
    jstring kind,
    jlong intervalMs,
    jstring group,
    jstring driftPolicy,
    jint maxRuns) {
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  TaskRecord t{};
  t.id = id;
  t.dueAtMs = dueAtMs;
  t.kind = jstringToUtf(env, kind);
  t.intervalMs = intervalMs;
  t.group = jstringToUtf(env, group);
  t.driftPolicy = jstringToUtf(env, driftPolicy);
  if (maxRuns < 0) {
    t.maxRuns = std::nullopt;
  } else {
    t.maxRuns = maxRuns;
  }
  t.runCount = 0;
  t.paused = false;
  core->schedule(t);
}

extern "C" JNIEXPORT void JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeCancel(JNIEnv* env,
                                                                                                    jclass,
                                                                                                    jlong handle,
                                                                                                    jint id) {
  (void)env;
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  core->cancel(id);
}

extern "C" JNIEXPORT jint JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativePauseGroup(
    JNIEnv* env,
    jclass,
    jlong handle,
    jstring group) {
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  return core->pauseGroup(jstringToUtf(env, group));
}

extern "C" JNIEXPORT jint JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeResumeGroup(
    JNIEnv* env,
    jclass,
    jlong handle,
    jlong nowMs,
    jstring group) {
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  return core->resumeGroup(jstringToUtf(env, group), nowMs);
}

extern "C" JNIEXPORT jint JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeCancelGroup(
    JNIEnv* env,
    jclass,
    jlong handle,
    jstring group) {
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  return core->cancelGroup(jstringToUtf(env, group));
}

extern "C" JNIEXPORT jlongArray JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativePopDuePairs(
    JNIEnv* env,
    jclass,
    jlong handle,
    jlong nowMs) {
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  const auto due = core->popDue(nowMs);
  const jsize pairCount = static_cast<jsize>(due.size()) * 2;
  jlongArray arr = env->NewLongArray(pairCount);
  if (arr == nullptr) {
    return nullptr;
  }
  std::vector<jlong> flat;
  flat.reserve(static_cast<size_t>(pairCount));
  for (const auto& t : due) {
    flat.push_back(static_cast<jlong>(t.id));
    flat.push_back(static_cast<jlong>(t.dueAtMs));
  }
  env->SetLongArrayRegion(arr, 0, pairCount, flat.data());
  return arr;
}

extern "C" JNIEXPORT jlong JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeNextDueMs(JNIEnv* env,
                                                                                                        jclass,
                                                                                                        jlong handle,
                                                                                                        jlong nowMs) {
  (void)env;
  (void)nowMs;
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  return core->nextDueMs(0);
}

extern "C" JNIEXPORT jintArray JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeListActiveIds(
    JNIEnv* env,
    jclass,
    jlong handle) {
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  const auto ids = core->listActiveIds();
  jintArray arr = env->NewIntArray(static_cast<jsize>(ids.size()));
  if (arr == nullptr) {
    return nullptr;
  }
  std::vector<jint> tmp(ids.begin(), ids.end());
  env->SetIntArrayRegion(arr, 0, static_cast<jsize>(tmp.size()), tmp.data());
  return arr;
}

extern "C" JNIEXPORT jlongArray JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeGetCoreStats(
    JNIEnv* env,
    jclass,
    jlong handle) {
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  const SchedulerStats st = core->getStats();
  jlongArray arr = env->NewLongArray(4);
  jlong buf[4] = {
      static_cast<jlong>(st.activeCount),
      st.callbackCount,
      st.missedCount,
      st.wakeupCount,
  };
  env->SetLongArrayRegion(arr, 0, 4, buf);
  return arr;
}

extern "C" JNIEXPORT jstring JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeGetGroupsJson(
    JNIEnv* env,
    jclass,
    jlong handle) {
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  const std::string j = core->getGroupsJson();
  return env->NewStringUTF(j.c_str());
}

extern "C" JNIEXPORT jboolean JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeIsActive(JNIEnv* env,
                                                                                                            jclass,
                                                                                                            jlong handle,
                                                                                                            jint id) {
  (void)env;
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  return core->isActive(id) ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jstring JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeExportPersistWireJson(
    JNIEnv* env,
    jclass,
    jlong handle) {
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  const std::string j = core->exportPersistWireJson();
  return env->NewStringUTF(j.c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeClearAll(JNIEnv* env, jclass, jlong handle) {
  (void)env;
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  core->clearAllTasks();
}

extern "C" JNIEXPORT void JNICALL Java_com_margelo_nitro_backgroundtimer_SchedulerNative_nativeImportTask(
    JNIEnv* env,
    jclass,
    jlong handle,
    jint id,
    jlong dueAtMs,
    jstring kind,
    jlong intervalMs,
    jstring group,
    jstring driftPolicy,
    jint maxRuns,
    jint runCount,
    jboolean paused) {
  auto* core = reinterpret_cast<SchedulerCore*>(handle);
  TaskRecord t{};
  t.id = id;
  t.dueAtMs = dueAtMs;
  t.kind = jstringToUtf(env, kind);
  t.intervalMs = intervalMs;
  t.group = jstringToUtf(env, group);
  t.driftPolicy = jstringToUtf(env, driftPolicy);
  if (maxRuns < 0) {
    t.maxRuns = std::nullopt;
  } else {
    t.maxRuns = maxRuns;
  }
  t.runCount = runCount;
  t.paused = paused == JNI_TRUE;
  core->importTaskRecord(t);
}
