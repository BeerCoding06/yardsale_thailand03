<!-- แนะนำ Add to Home Screen บน iPhone/iPad เพื่อใช้ FCM (iOS 16.4+) -->
<script setup lang="ts">
import { iosFcmBlockedOutsideStandalone } from "~/utils/fcmIosContext";

const config = useRuntimeConfig();

const DISMISS_KEY = "yardsale_fcm_ios_install_dismissed";

const dismissed = ref(false);
const visible = computed(() => {
  if (!import.meta.client) return false;
  if (dismissed.value) return false;
  try {
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return false;
  } catch {
    /* private mode */
  }
  const pub = config.public as Record<string, unknown>;
  const hasFcm =
    String(pub.firebaseApiKey || "").trim() &&
    String(pub.firebaseProjectId || "").trim() &&
    String(pub.firebaseVapidKey || "").trim();
  if (!hasFcm) return false;
  return iosFcmBlockedOutsideStandalone();
});

function dismiss() {
  dismissed.value = true;
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-x-0 bottom-0 z-[100] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
        role="dialog"
        aria-labelledby="fcm-ios-install-title"
      >
        <div
          class="pointer-events-auto mx-auto max-w-lg rounded-2xl border-2 border-alizarin-crimson-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-alizarin-crimson-800 dark:bg-neutral-900/95"
        >
          <div class="flex gap-3">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-alizarin-crimson-100 dark:bg-alizarin-crimson-950"
            >
              <UIcon
                name="i-heroicons-device-phone-mobile"
                class="h-6 w-6 text-alizarin-crimson-600 dark:text-alizarin-crimson-400"
              />
            </div>
            <div class="min-w-0 flex-1">
              <h2
                id="fcm-ios-install-title"
                class="text-sm font-bold text-neutral-900 dark:text-white"
              >
                {{ $t("fcm_ios.prompt_title") }}
              </h2>
              <p class="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                {{ $t("fcm_ios.prompt_body") }}
              </p>
              <ol
                class="mt-2 list-decimal space-y-1 ps-4 text-xs text-neutral-800 dark:text-neutral-200"
              >
                <li>{{ $t("fcm_ios.step_share") }}</li>
                <li>{{ $t("fcm_ios.step_add") }}</li>
                <li>{{ $t("fcm_ios.step_open") }}</li>
              </ol>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              :aria-label="$t('fcm_ios.dismiss')"
              @click="dismiss"
            >
              <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
            </button>
          </div>
          <div class="mt-3 flex justify-end">
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-semibold text-alizarin-crimson-700 hover:bg-alizarin-crimson-50 dark:text-alizarin-crimson-300 dark:hover:bg-alizarin-crimson-950/50"
              @click="dismiss"
            >
              {{ $t("fcm_ios.dismiss") }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
