export default defineNuxtPlugin(() => {
  const { user } = useAuth();
  const { initFcmPush } = useFcmPush();

  const resolveUserId = () => user.value?.id ?? user.value?.ID;

  onNuxtReady(() => {
    initFcmPush(resolveUserId());
  });

  watch(
    () => resolveUserId(),
    (nextId, prevId) => {
      if (nextId && nextId !== prevId) {
        initFcmPush(nextId);
      }
    }
  );
});
