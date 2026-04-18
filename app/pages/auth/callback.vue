<script setup lang="ts">
definePageMeta({
  layout: false,
});

const route = useRoute();
const localePath = useLocalePath();
const { setTokensAndHydrate } = useAuth();

const status = ref<"idle" | "working" | "ok" | "err">("idle");
const message = ref("");

onMounted(async () => {
  const err = route.query.error;
  if (err) {
    status.value = "err";
    message.value = String(route.query.error_description || err);
    return;
  }
  const token = route.query.token;
  const refresh = route.query.refresh;
  if (typeof token !== "string" || !token.trim()) {
    status.value = "err";
    message.value = "Missing token";
    return;
  }
  status.value = "working";
  try {
    await setTokensAndHydrate({
      token: token.trim(),
      refreshToken: typeof refresh === "string" ? refresh : undefined,
    });
    status.value = "ok";
    await navigateTo(localePath("/profile"));
  } catch (e: unknown) {
    status.value = "err";
    message.value =
      (e as { data?: { error?: { message?: string } } })?.data?.error?.message ||
      (e as Error)?.message ||
      "Login failed";
  }
});
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-6"
  >
    <div class="text-center max-w-md">
      <p v-if="status === 'working'" class="text-neutral-700 dark:text-neutral-200">
        กำลังเข้าสู่ระบบ…
      </p>
      <p v-else-if="status === 'err'" class="text-red-600 dark:text-red-400">
        {{ message }}
      </p>
      <NuxtLink
        :to="localePath('/login')"
        class="mt-6 inline-block text-alizarin-crimson-600 dark:text-alizarin-crimson-400 underline"
      >
        กลับไปหน้าเข้าสู่ระบบ
      </NuxtLink>
    </div>
  </div>
</template>
