export default defineNuxtPlugin(() => {
  const { user } = useAuth();
  const { initFcmPush } = useFcmPush();

  const resolveUserId = () => user.value?.id ?? user.value?.ID;

  /** รอ state ผู้ใช้จาก localStorage / fetchMe แล้วค่อย init — และ sync token หลังล็อกอิน (JWT เปลี่ยน) */
  watch(
    () => [resolveUserId(), user.value?.token] as const,
    async () => {
      await nextTick();
      await initFcmPush(resolveUserId());
    },
    { immediate: true }
  );

  /** กลับจากพื้นหลัง / เปิดจาก PWA หลังเพิ่มหน้าจอโฮม — ลองลงทะเบียน FCM อีกครั้ง */
  if (import.meta.client) {
    window.addEventListener("pageshow", () => {
      void initFcmPush(resolveUserId());
    });
  }
});
