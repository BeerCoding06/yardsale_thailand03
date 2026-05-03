<!-- User ↔ Admin support chat -->
<script setup>
definePageMeta({ middleware: "auth", ssr: false });

const { t } = useI18n();
const localePath = useLocalePath();
const router = useRouter();
const { hasRemoteApi } = useStorefrontCatalog();
const { user, checkAuth } = useAuth();
const { isAdmin } = useRoles();
const {
  startConversation,
  fetchMessages,
  sendMessage,
  fetchUnreadCount,
} = useChat();

const conversation = ref(null);
const messages = ref([]);
const loading = ref(true);
const sending = ref(false);
const errorText = ref("");
const input = ref("");
const listEl = ref(null);
let pollTimer = null;
const POLL_MS = 4000;
const unreadBadge = ref(0);

function scrollToBottom() {
  nextTick(() => {
    const el = listEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

async function refreshMessages() {
  if (!conversation.value?.id) return;
  try {
    const data = await fetchMessages(conversation.value.id, { limit: 200, offset: 0 });
    messages.value = data?.messages ?? [];
    if (data?.conversation) conversation.value = data.conversation;
    scrollToBottom();
  } catch {
    /* keep existing messages */
  }
}

async function boot() {
  loading.value = true;
  errorText.value = "";
  try {
    const started = await startConversation();
    conversation.value = started?.conversation ?? null;
    await refreshMessages();
    try {
      const u = await fetchUnreadCount();
      unreadBadge.value = u?.unread_count ?? 0;
    } catch {
      unreadBadge.value = 0;
    }
  } catch (e) {
    errorText.value =
      e?.data?.error?.message ||
      e?.data?.message ||
      e?.message ||
      t("support_chat.error_start");
  } finally {
    loading.value = false;
    scrollToBottom();
  }
}

async function onSend() {
  const text = input.value.trim();
  if (!text || !conversation.value?.id || sending.value) return;
  if (conversation.value.status === "resolved") {
    errorText.value = t("support_chat.conv_closed_hint");
    return;
  }
  sending.value = true;
  errorText.value = "";
  try {
    await sendMessage(conversation.value.id, text);
    input.value = "";
    await refreshMessages();
  } catch (e) {
    errorText.value =
      e?.data?.error?.message ||
      e?.data?.message ||
      e?.message ||
      t("support_chat.error_send");
  } finally {
    sending.value = false;
  }
}

function startPoll() {
  stopPoll();
  pollTimer = setInterval(() => {
    refreshMessages();
  }, POLL_MS);
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onMounted(async () => {
  checkAuth();
  await nextTick();
  if (isAdmin.value) {
    await router.replace(localePath("/admin/chat"));
    return;
  }
  if (!hasRemoteApi) {
    loading.value = false;
    return;
  }
  await boot();
  startPoll();
});

onUnmounted(() => {
  stopPoll();
});

watch(
  () => messages.value.length,
  () => scrollToBottom()
);
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black py-6 px-4">
    <div class="max-w-2xl mx-auto">
      <div class="flex items-center justify-between gap-3 mb-4">
        <h1 class="text-xl font-bold text-black dark:text-white">
          {{ $t("support_chat.title") }}
        </h1>
        <NuxtLink
          :to="localePath('/')"
          class="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
        >
          {{ $t("support_chat.back_home") }}
        </NuxtLink>
      </div>

      <div
        v-if="!hasRemoteApi"
        class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100"
      >
        {{ $t("support_chat.no_api") }}
      </div>

      <template v-else>
        <div
          v-if="conversation"
          class="flex flex-wrap items-center gap-2 mb-3 text-sm"
        >
          <span
            class="inline-flex items-center px-2 py-0.5 rounded-lg font-medium"
            :class="
              conversation.status === 'resolved'
                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100'
                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100'
            "
          >
            {{
              conversation.status === "resolved"
                ? $t("support_chat.status_resolved")
                : $t("support_chat.status_open")
            }}
          </span>
          <span v-if="unreadBadge > 0" class="text-alizarin-crimson-600 dark:text-alizarin-crimson-400 text-xs">
            {{ $t("support_chat.unread_badge", { n: unreadBadge }) }}
          </span>
        </div>

        <div
          v-if="loading"
          class="flex justify-center py-16"
        >
          <UIcon
            name="i-svg-spinners-90-ring-with-bg"
            class="w-10 h-10 text-neutral-400"
          />
        </div>

        <div
          v-else-if="errorText && !conversation"
          class="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200"
        >
          {{ errorText }}
        </div>

        <div
          v-else
          class="rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-black/40 overflow-hidden flex flex-col"
          style="min-height: 360px; max-height: min(70vh, 560px)"
        >
          <div
            ref="listEl"
            class="flex-1 overflow-y-auto p-4 space-y-3"
          >
            <p
              v-if="!messages.length && !loading"
              class="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8"
            >
              {{ $t("support_chat.empty_thread") }}
            </p>
            <div
              v-for="m in messages"
              :key="m.id"
              class="flex"
              :class="m.sender_type === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm"
                :class="
                  m.sender_type === 'user'
                    ? 'bg-alizarin-crimson-600 text-white rounded-br-md'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white rounded-bl-md'
                "
              >
                <p class="text-[10px] uppercase tracking-wide opacity-80 mb-1">
                  {{
                    m.sender_type === "user"
                      ? $t("support_chat.label_you")
                      : $t("support_chat.label_support")
                  }}
                </p>
                <p class="whitespace-pre-wrap break-words">{{ m.message }}</p>
                <p
                  class="text-[10px] mt-1 opacity-70"
                >
                  {{
                    m.created_at
                      ? new Date(m.created_at).toLocaleString()
                      : ""
                  }}
                </p>
              </div>
            </div>
          </div>

          <div class="p-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50/80 dark:bg-black/30">
            <p
              v-if="errorText && conversation"
              class="text-xs text-red-600 dark:text-red-400 mb-2"
            >
              {{ errorText }}
            </p>
            <div class="flex gap-2">
              <textarea
                v-model="input"
                rows="2"
                :disabled="sending || conversation?.status === 'resolved'"
                class="flex-1 rounded-xl border-2 border-neutral-200 dark:border-neutral-600 bg-white dark:bg-black/30 px-3 py-2 text-sm text-black dark:text-white placeholder:text-neutral-400 resize-none focus:outline-none focus:border-alizarin-crimson-600"
                :placeholder="$t('support_chat.placeholder')"
                @keydown.enter.exact.prevent="onSend"
              />
              <button
                type="button"
                :disabled="sending || !input.trim() || conversation?.status === 'resolved'"
                class="shrink-0 px-4 rounded-xl font-semibold text-white bg-alizarin-crimson-600 hover:bg-alizarin-crimson-700 disabled:opacity-50 disabled:cursor-not-allowed"
                @click="onSend"
              >
                {{ sending ? "…" : $t("support_chat.send") }}
              </button>
            </div>
            <p
              v-if="conversation?.status === 'resolved'"
              class="text-xs text-neutral-500 mt-2"
            >
              {{ $t("support_chat.conv_closed_hint") }}
            </p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
