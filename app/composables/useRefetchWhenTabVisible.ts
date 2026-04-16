/**
 * รีเฟรชรายการเมื่อผู้ใช้กลับมาโฟกัสแท็บ/หน้าต่าง — ใช้หลังชำระเงินแล้วสลับแอป
 * debounce กันยิงซ้ำจาก visibilitychange + focus
 */
export function useRefetchWhenTabVisible(callback: () => void | Promise<void>) {
  if (!import.meta.client) return;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const run = () => {
    if (document.visibilityState !== "visible") return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void Promise.resolve(callback());
    }, 350);
  };

  onMounted(() => {
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
  });

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    document.removeEventListener("visibilitychange", run);
    window.removeEventListener("focus", run);
  });
}
