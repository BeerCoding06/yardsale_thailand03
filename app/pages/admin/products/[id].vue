<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();

const id = computed(() => String(route.params.id || ""));
</script>

<template>
  <div class="space-y-4 px-2 py-2">
    <div>
      <NuxtLink
        :to="localePath('/admin/products')"
        class="text-sm text-alizarin-crimson-600 hover:underline inline-block"
      >
        ← {{ t("admin.products.back_list") }}
      </NuxtLink>
    </div>
    <UserFormCreateProducts :product-id-for-edit="id" admin-edit />
  </div>
</template>
