<script setup>
const localePath = useLocalePath();
definePageMeta({
  layout: "default",
});
</script>

<template>
  <div class="min-h-[60vh] bg-neutral-50 dark:bg-black">
    <GuideArticle prefix="guide.seller" :section-count="8" />
    <div
      class="max-w-3xl mx-auto px-4 sm:px-6 pb-12 flex flex-wrap items-center gap-4 text-sm font-medium"
    >
      <NuxtLink
        :to="localePath('/guide/buyer')"
        class="text-alizarin-crimson-600 dark:text-alizarin-crimson-400 hover:underline"
      >
        {{ $t("guide.nav_to_buyer") }}
      </NuxtLink>
      <NuxtLink
        :to="localePath('/')"
        class="text-neutral-600 dark:text-neutral-400 hover:underline"
      >
        {{ $t("guide.nav_home") }}
      </NuxtLink>
    </div>
  </div>
</template>
