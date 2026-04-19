<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const localePath = useLocalePath();

const cards = computed(() => [
  {
    to: localePath("/admin/products"),
    title: t("admin.nav.products"),
    desc: t("admin.dashboard.products_desc"),
    icon: "i-heroicons-cube",
  },
  {
    to: localePath("/admin/categories"),
    title: t("admin.nav.categories"),
    desc: t("admin.dashboard.categories_desc"),
    icon: "i-heroicons-tag",
  },
  {
    to: localePath("/admin/tags"),
    title: t("admin.nav.tags"),
    desc: t("admin.dashboard.tags_desc"),
    icon: "i-heroicons-hashtag",
  },
  {
    to: localePath("/admin/users"),
    title: t("admin.nav.users"),
    desc: t("admin.dashboard.users_desc"),
    icon: "i-heroicons-user-plus",
  },
  {
    to: localePath("/admin/orders"),
    title: t("admin.nav.orders"),
    desc: t("admin.dashboard.orders_desc"),
    icon: "i-heroicons-clipboard-document-list",
  },
  {
    to: localePath("/admin/finance"),
    title: t("admin.nav.finance"),
    desc: t("admin.dashboard.finance_desc"),
    icon: "i-heroicons-banknotes",
  },
]);
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
        {{ t("admin.dashboard.heading") }}
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400 mt-1">
        {{ t("admin.dashboard.lead") }}
      </p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="c in cards"
        :key="c.to"
        :to="c.to"
        class="group block rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm hover:border-alizarin-crimson-500/50 transition"
      >
        <div class="flex items-start gap-4">
          <div
            class="rounded-xl bg-alizarin-crimson-600/10 dark:bg-alizarin-crimson-500/20 p-3 text-alizarin-crimson-600 dark:text-alizarin-crimson-400"
          >
            <UIcon :name="c.icon" class="w-7 h-7" />
          </div>
          <div>
            <h2 class="font-semibold text-lg text-neutral-900 dark:text-white group-hover:text-alizarin-crimson-600 dark:group-hover:text-alizarin-crimson-400">
              {{ c.title }}
            </h2>
            <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {{ c.desc }}
            </p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
