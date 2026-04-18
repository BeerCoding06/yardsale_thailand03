<!--app/pages/login.vue — import ชัดเจน + ปุ่มโซเชียลที่ระดับหน้า (กัน auto-import / build เก่าไม่รวมบล็อกใน FormLogin) -->
<script setup lang="ts">
import FormLogin from "~/components/user/FormLogin.vue";
import SocialLoginButtons from "~/components/user/SocialLoginButtons.vue";
</script>

<template>
  <div>
    <FormLogin />
    <div class="max-w-4xl mx-auto px-6 pb-8">
      <ClientOnly>
        <SocialLoginButtons class="mt-6" />
        <template #fallback>
          <div
            class="mt-6 h-32 max-w-4xl mx-auto rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-900/40 animate-pulse"
            aria-hidden="true"
          />
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
