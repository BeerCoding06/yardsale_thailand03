<!-- รูปจาก API โดเมนอื่น (เช่น https://api.../uploads/...) — ไม่ส่งผ่าน IPX /_ipx/ เพราะฝั่งเซิร์ฟเวอร์ดึงรูปไม่ได้ (Cloudflare/bot) จะ 500 -->
<script setup>
defineOptions({ inheritAttrs: false });

const props = defineProps({
  src: { type: String, default: "" },
  alt: { type: String, default: "" },
  title: { type: String, default: "" },
});

const attrs = useAttrs();

const isExternalHttp = computed(() =>
  /^https?:\/\//i.test(String(props.src || "").trim())
);
</script>

<template>
  <img
    v-if="isExternalHttp && src"
    :src="src"
    :alt="alt"
    :title="title || undefined"
    loading="lazy"
    decoding="async"
    v-bind="attrs"
  />
  <NuxtImg
    v-else-if="src"
    :src="src"
    :alt="alt"
    :title="title"
    loading="lazy"
    v-bind="attrs"
  />
</template>
