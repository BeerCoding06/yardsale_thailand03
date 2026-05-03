<!-- Admin: support inbox -->
<script setup>
definePageMeta({ middleware: ["auth", "admin"], ssr: false });

const { t } = useI18n();
const localePath = useLocalePath();
const { hasRemoteApi } = useStorefrontCatalog();
const {
  fetchAdminConversations,
  fetchMessages,
  sendMessage,
  resolveConversation,
} = useChat();

const conversations = ref([]);
const total = ref(0);
const unreadTotal = ref(0);
const loadingList = ref(true);
const loadingMsgs = ref(false);
const selectedId = ref(null);
const messages = ref([]);
const activeConversation = ref(null);
const input = ref("");
const sending = ref(false);
const listError = ref("");
const msgError = ref("");
const listEl = ref(null);
let pollTimer = null;
const POLL_MS = 4000;

function scrollToBottom() {
  nextTick(() => {
    const el = listEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

async function loadList() {
  listError.value = "";
  try {
    const data = await fetchAdminConversations({ limit: 50, offset: 0 });
    conversations.value = data?.conversations ?? [];
    total.value = data?.total ?? 0;
    unreadTotal.value = data?.unread_total ?? 0;
  } catch (e) {
    listError.value =
      e?.data?.error?.message || e?.message || t("support_chat.admin_list_error");
  } finally {
    loadingList.value = false;
  }
}

async function selectConversation(id) {
  if (!id || selectedId.value === id) return;
  selectedId.value = id;
  loadingMsgs.value = true;
  msgError.value = "";
  messages.value = [];
  try {
    const data = await fetchMessages(id, { limit: 200, offset: 0 });
    messages.value = data?.messages ?? [];
    activeConversation.value = data?.conversation ?? null;
    scrollToBottom();
  } catch (e) {
    msgError.value =
      e?.data?.error?.message || e?.message || t("support_chat.error_load_messages");
  } finally {
    loadingMsgs.value = false;
  }
}

async function refreshMessages() {
  if (!selectedId.value) return;
  try {
    const data = await fetchMessages(selectedId.value, { limit: 200, offset: 0 });
    messages.value = data?.messages ?? [];
    activeConversation.value = data?.conversation ?? null;
    scrollToBottom();
  } catch {
    /* ignore poll errors */
  }
}

async function onSend() {
  const text = input.value.trim();
  if (!text || !selectedId.value || sending.value) return;
  sending.value = true;
  msgError.value = "";
  try {
    await sendMessage(selectedId.value, text);
    input.value = "";
    await refreshMessages();
    await loadList();
  } catch (e) {
    msgError.value =
      e?.data?.error?.message || e?.message || t("support_chat.error_send");
  } finally {
    sending.value = false;
  }
}

async function onResolve() {
  if (!selectedId.value) return;
  try {
    await resolveConversation(selectedId.value);
    await refreshMessages();
    await loadList();
  } catch (e) {
    msgError.value =
      e?.data?.error?.message || e?.message || t("support_chat.error_resolve");
  }
}

function startPoll() {
  stopPoll();
  pollTimer = setInterval(() => {
    refreshMessages();
    loadList();
  }, POLL_MS);
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onMounted(async () => {
  if (!hasRemoteApi) {
    loadingList.value = false;
    return;
  }
  await loadList();
  startPoll();
});

onUnmounted(() => stopPoll());

watch(
  () => messages.value.length,
  () => scrollToBottom()
);
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black py-6 px-4">
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 class="text-xl font-bold text-black dark:text-white">
            {{ $t("support_chat.admin_title") }}
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            {{ $t("support_chat.admin_subtitle", { total, unread: unreadTotal }) }}
          </p>
        </div>
        <NuxtLink
          :to="localePath('/admin')"
          class="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
        >
          {{ $t("support_chat.back_admin") }}
        </NuxtLink>
      </div>

      <div
        v-if="!hasRemoteApi"
        class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm"
      >
        {{ $t("support_chat.no_api") }}
      </div>

      <div
        v-else
        class="grid grid-cols-1 md:grid-cols-5 gap-4 min-h-[480px]"
      >
        <div
          class="md:col-span-2 rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-black/40 overflow-hidden flex flex-col max-h-[70vh]"
        >
          <div class="p-3 border-b border-neutral-200 dark:border-neutral-700 font-semibold text-sm">
            {{ $t("support_chat.inbox") }}
          </div>
          <div class="overflow-y-auto flex-1">
            <div
              v-if="loadingList"
              class="flex justify-center py-12"
            >
              <UIcon
                name="i-svg-spinners-90-ring-with-bg"
                class="w-8 h-8 text-neutral-400"
              />
            </div>
            <p
              v-else-if="listError"
              class="p-3 text-sm text-red-600"
            >
              {{ listError }}
            </p>
            <button
              v-for="c in conversations"
              :key="c.id"
              type="button"
              class="w-full text-left px-3 py-3 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition"
              :class="
                selectedId === c.id
                  ? 'bg-alizarin-crimson-50 dark:bg-alizarin-crimson-950/30'
                  : ''
              "
              @click="selectConversation(c.id)"
            >
              <div class="flex justify-between gap-2">
                <span class="font-medium text-sm text-black dark:text-white truncate">
                  {{ c.user_name || c.user_email || "—" }}
                </span>
                <span
                  v-if="c.unread_for_admin > 0"
                  class="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-alizarin-crimson-600 text-white"
                >
                  {{ c.unread_for_admin }}
                </span>
              </div>
              <p class="text-xs text-neutral-500 truncate mt-0.5">
                {{ c.last_message_preview || "—" }}
              </p>
              <div class="flex gap-2 mt-1 text-[10px] text-neutral-400">
                <span>{{ c.status }}</span>
                <span v-if="c.updated_at">{{ new Date(c.updated_at).toLocaleString() }}</span>
              </div>
            </button>
            <p
              v-if="!loadingList && !conversations.length && !listError"
              class="p-6 text-center text-sm text-neutral-500"
            >
              {{ $t("support_chat.admin_empty_inbox") }}
            </p>
          </div>
        </div>

        <div
          class="md:col-span-3 rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-black/40 flex flex-col max-h-[70vh]"
        >
          <div
            class="p-3 border-b border-neutral-200 dark:border-neutral-700 flex flex-wrap items-center justify-between gap-2"
          >
            <span class="font-semibold text-sm text-black dark:text-white truncate max-w-[70%]">
              {{
                activeConversation
                  ? (conversations.find((x) => x.id === selectedId)?.user_email || selectedId)
                  : $t("support_chat.pick_thread")
              }}
            </span>
            <button
              v-if="selectedId && activeConversation?.status === 'open'"
              type="button"
              class="text-xs px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white hover:opacity-90"
              @click="onResolve"
            >
              {{ $t("support_chat.mark_resolved") }}
            </button>
          </div>

          <div
            v-if="!selectedId"
            class="flex-1 flex items-center justify-center text-neutral-500 text-sm p-8"
          >
            {{ $t("support_chat.pick_thread") }}
          </div>

          <template v-else>
            <div
              v-if="loadingMsgs"
              class="flex justify-center py-16"
            >
              <UIcon
                name="i-svg-spinners-90-ring-with-bg"
                class="w-8 h-8 text-neutral-400"
              />
            </div>
            <div
              v-else
              ref="listEl"
              class="flex-1 overflow-y-auto p-4 space-y-3"
            >
              <p
                v-if="msgError"
                class="text-sm text-red-600"
              >
                {{ msgError }}
              </p>
              <div
                v-for="m in messages"
                :key="m.id"
                class="flex"
                :class="m.sender_type === 'admin' ? 'justify-end' : 'justify-start'"
              >
                <div
                  class="max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm"
                  :class="
                    m.sender_type === 'admin'
                      ? 'bg-alizarin-crimson-600 text-white rounded-br-md'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white rounded-bl-md'
                  "
                >
                  <p class="text-[10px] uppercase opacity-80 mb-1">
                    {{
                      m.sender_type === "admin"
                        ? $t("support_chat.label_support")
                        : $t("support_chat.label_customer")
                    }}
                  </p>
                  <p class="whitespace-pre-wrap break-words">{{ m.message }}</p>
                  <p class="text-[10px] mt-1 opacity-70">
                    {{ m.created_at ? new Date(m.created_at).toLocaleString() : "" }}
                  </p>
                </div>
              </div>
              <p
                v-if="!messages.length && !loadingMsgs"
                class="text-center text-sm text-neutral-500 py-8"
              >
                {{ $t("support_chat.empty_thread") }}
              </p>
            </div>

            <div class="p-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50/80 dark:bg-black/30">
              <div
                v-if="activeConversation?.status === 'resolved'"
                class="text-xs text-neutral-500 mb-2"
              >
                {{ $t("support_chat.thread_resolved_hint") }}
              </div>
              <div class="flex gap-2">
                <textarea
                  v-model="input"
                  rows="2"
                  :disabled="sending || activeConversation?.status === 'resolved'"
                  class="flex-1 rounded-xl border-2 border-neutral-200 dark:border-neutral-600 bg-white dark:bg-black/30 px-3 py-2 text-sm resize-none focus:outline-none focus:border-alizarin-crimson-600"
                  :placeholder="$t('support_chat.placeholder')"
                  @keydown.enter.exact.prevent="onSend"
                />
                <button
                  type="button"
                  :disabled="
                    sending ||
                      !input.trim() ||
                      activeConversation?.status === 'resolved'
                  "
                  class="shrink-0 px-4 rounded-xl font-semibold text-white bg-alizarin-crimson-600 disabled:opacity-50"
                  @click="onSend"
                >
                  {{ sending ? "…" : $t("support_chat.send") }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
