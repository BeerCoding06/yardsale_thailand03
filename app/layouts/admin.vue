<script setup lang="ts">
import { useChat } from '~/composables/useChat';

const localePath = useLocalePath();
const route = useRoute();
const { t } = useI18n();

const links = computed(() => {
  const dash = localePath("/admin");
  const users = localePath("/admin/users");
  const orders = localePath("/admin/orders");
  const supportChat = localePath("/admin/chat");
  const finance = localePath("/admin/finance");
  const prods = localePath("/admin/products");
  const cats = localePath("/admin/categories");
  const tagz = localePath("/admin/tags");
  const p = route.path.replace(/\/$/, "") || "/";
  const n = (s: string) => s.replace(/\/$/, "") || "/";
  return [
    {
      to: dash,
      label: t("admin.nav.dashboard"),
      icon: "i-heroicons-home",
      active: n(p) === n(dash),
    },
    {
      to: prods,
      label: t("admin.nav.products"),
      icon: "i-heroicons-cube",
      active: n(p) === n(prods) || p.startsWith(n(prods) + "/"),
    },
    {
      to: cats,
      label: t("admin.nav.categories"),
      icon: "i-heroicons-tag",
      active: n(p) === n(cats),
    },
    {
      to: tagz,
      label: t("admin.nav.tags"),
      icon: "i-heroicons-hashtag",
      active: n(p) === n(tagz),
    },
    {
      to: users,
      label: t("admin.nav.users"),
      icon: "i-heroicons-user-plus",
      active: n(p) === n(users) || p.startsWith(n(users) + "/"),
    },
    {
      to: orders,
      label: t("admin.nav.orders"),
      icon: "i-heroicons-clipboard-document-list",
      active: n(p) === n(orders) || p.startsWith(n(orders) + "/"),
    },
    {
      to: supportChat,
      label: t("admin.nav.support_chat"),
      icon: "i-heroicons-chat-bubble-left-right",
      active: n(p) === n(supportChat),
    },
    {
      to: finance,
      label: t("admin.nav.finance"),
      icon: "i-heroicons-banknotes",
      active: n(p) === n(finance) || p.startsWith(n(finance) + "/"),
    },
  ];
});

const { fetchAdminConversations } = useChat();

const unreadBadge = ref(0);

async function loadUnread() {
  try {
    const data = await fetchAdminConversations({ limit: 1, offset: 0 });
    unreadBadge.value = (data as any)?.unread_total ?? 0;
  } catch {
    unreadBadge.value = 0;
  }
}

onMounted(loadUnread);
</script>

<template>
  <div class="min-h-screen bg-neutral-100 dark:bg-neutral-950 flex flex-col md:flex-row">
    <aside
      class="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
    >
      <div class="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <NuxtLink
          :to="localePath('/admin')"
          class="text-lg font-bold text-alizarin-crimson-600 dark:text-alizarin-crimson-400"
        >
          {{ t("admin.title") }}
        </NuxtLink>
        <p class="text-xs text-neutral-500 mt-1">{{ t("admin.subtitle") }}</p>
      </div>
      <nav class="p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
        <NuxtLink
          v-for="item in links"
          :key="item.to"
          :to="item.to"
          :class="[
            'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition',
            item.active
              ? 'bg-alizarin-crimson-600 text-white'
              : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800',
          ]"
        >
          <UIcon :name="item.icon" class="w-5 h-5 shrink-0" />
          <span v-if="item.label === t('admin.nav.support_chat') && unreadBadge > 0" class="relative inline-flex rounded-full h-[18px] w-[18px] bg-alizarin-crimson-700 text-[10px] items-center justify-center shadow font-semibold text-white">{{ unreadBadge }}</span>
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="p-4 hidden md:block border-t border-neutral-200 dark:border-neutral-800">
        <NuxtLink
          :to="localePath('/')"
          class="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
        >
          ← {{ t("admin.back_store") }}
        </NuxtLink>
      </div>
    </aside>
    <main class="flex-1 min-w-0 p-4 md:p-8">
      <slot />
    </main>
  </div>
</template>
