<!-- รูปจาก API: path /uploads/... หรือ URL เต็ม — resolve เป็น origin backend แล้วใช้ <img> ไม่ผ่าน IPX (กัน 500 / รูปพัง) -->
<script setup>
defineOptions({ inheritAttrs: false });

const props = defineProps({
  src: { type: String, default: "" },
  alt: { type: String, default: "" },
  title: { type: String, default: "" },
});

const attrs = useAttrs();
const { resolveMediaUrl } = useStorefrontCatalog();

const resolvedSrc = computed(() => {
  const s = String(props.src || "").trim();
  if (!s) return "";
  return resolveMediaUrl(s) || s;
});

/** ไม่ส่งผ่าน NuxtImg/IPX เมื่อเป็น URL ที่โหลดตรงได้หรือข้อมูลฝัง */
const useNativeImg = computed(() => {
  const u = resolvedSrc.value;
  if (!u) return false;
  if (/^https?:\/\//i.test(u)) return true;
  if (/^(data:|blob:)/i.test(u)) return true;
  return false;
});
</script>

<template>
  <img
    v-if="useNativeImg && resolvedSrc"
    :src="resolvedSrc"
    :alt="alt"
    :title="title || undefined"
    loading="lazy"
    decoding="async"
    v-bind="attrs"
  />
  <NuxtImg
    v-else-if="resolvedSrc"
    :src="resolvedSrc"
    :alt="alt"
    :title="title"
    loading="lazy"
    v-bind="attrs"
  />
</template>
