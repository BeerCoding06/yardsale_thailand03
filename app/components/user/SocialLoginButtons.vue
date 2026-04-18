<script setup lang="ts">
const { startGoogle, startFacebook, startLine } = useOAuthLogin();
</script>

<template>
  <div class="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
    <p class="text-center text-sm text-neutral-500 dark:text-neutral-400">
      หรือเข้าสู่ระบบด้วย
    </p>
    <div class="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
      <UButton
        color="white"
        variant="solid"
        class="ring-1 ring-neutral-200 dark:ring-neutral-700"
        block
        @click="startGoogle"
      >
        Google
      </UButton>
      <UButton color="blue" variant="solid" block @click="startFacebook">
        Facebook
      </UButton>
      <UButton color="green" variant="solid" block @click="startLine">
        LINE
      </UButton>
    </div>
  </div>
</template>
