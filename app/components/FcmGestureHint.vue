<!-- ปุ่มขอสิทธิ์แจ้งเตือน (Safari เดสก์ท็อป / iOS PWA) — ต้องมาจาก user gesture -->
<script setup lang="ts">
const { user } = useAuth();
const { awaitingSafariGesture, enablePushFromUserGesture, dismissPushPermissionPrompt } =
  useFcmPush();

const busy = ref(false);

const visible = computed(() => {
  if (!import.meta.client) return false;
  if (!awaitingSafariGesture.value) return false;
  if (typeof Notification === "undefined") return false;
  return Notification.permission === "default";
});

const resolveUserId = () => user.value?.id ?? user.value?.ID;

async function onEnable() {
  if (busy.value) return;
  busy.value = true;
  try {
    await enablePushFromUserGesture(resolveUserId());
  } finally {
    busy.value = false;
  }
}

function onNotNow() {
  dismissPushPermissionPrompt();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-x-0 bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-[99] flex justify-center px-3 pointer-events-none sm:bottom-6"
        role="status"
      >
        <div
          class="pointer-events-auto flex max-w-md flex-col gap-2 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-xl backdrop-blur-md dark:border-neutral-700 dark:bg-neutral-900/95 sm:flex-row sm:items-center sm:gap-3"
        >
          <p class="text-xs text-neutral-700 dark:text-neutral-200 sm:text-sm">
            {{ $t("fcm_ios.gesture_hint") }}
          </p>
          <div class="flex shrink-0 gap-2 sm:justify-end">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="busy"
              @click="onNotNow"
            >
              {{ $t("fcm_ios.not_now") }}
            </UButton>
            <UButton
              color="primary"
              size="xs"
              :loading="busy"
              @click="onEnable"
            >
              {{ $t("fcm_ios.enable_notifications") }}
            </UButton>
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
