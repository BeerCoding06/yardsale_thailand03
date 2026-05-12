<!-- Reusable guide body: prefix = 'guide.seller' | 'guide.buyer' -->
<script setup>
const props = defineProps({
  prefix: {
    type: String,
    required: true,
  },
  /** Number of sections (s1_title / s1_body … sN) present in i18n */
  sectionCount: {
    type: Number,
    default: 6,
  },
});

const { t } = useI18n();

const sectionIndexes = computed(() =>
  Array.from({ length: Math.max(0, props.sectionCount) }, (_, i) => i + 1)
);

useHead(() => ({
  title: t(props.prefix + ".meta_title"),
}));
</script>

<template>
  <article
    class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 text-black dark:text-neutral-100"
  >
    <h1 class="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
      {{ $t(prefix + '.title') }}
    </h1>
    <p
      class="text-base sm:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed mb-10 border-l-4 border-alizarin-crimson-500 pl-4"
    >
      {{ $t(prefix + '.lead') }}
    </p>

    <section
      v-for="i in sectionIndexes"
      :key="i"
      class="mb-10 last:mb-0"
    >
      <h2 class="text-lg sm:text-xl font-semibold mb-3 text-neutral-900 dark:text-white">
        {{ $t(prefix + '.s' + i + '_title') }}
      </h2>
      <p
        class="text-sm sm:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line"
      >
        {{ $t(prefix + '.s' + i + '_body') }}
      </p>
    </section>
  </article>
</template>
