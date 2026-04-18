<script setup lang="ts">
/**
 * แท็ก `<socialloginbuttons>` — อย่าวางไฟล์นี้ในโฟลเดอร์เดียวกับ SocialLoginButtons.vue
 * เพราะบน macOS (case-insensitive) ชื่อสองไฟล์นี้ชี้ไฟล์เดียวกัน
 */
import SocialLoginButtons from "~/components/user/SocialLoginButtons.vue";
</script>

<template>
  <SocialLoginButtons v-bind="$attrs" />
</template>
