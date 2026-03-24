<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const localePath = useLocalePath();
const { adminFetch } = useAdminFetch();
const { push } = useNotivue();

const form = ref({
  name: "",
  description: "",
  price: "" as string | number,
  stock: "" as string | number,
  image_url: "",
  category_id: "",
  seller_id: "",
  listing_status: "pending_review" as
    | "pending_review"
    | "published"
    | "hidden",
});

const isSubmitting = ref(false);

async function submit() {
  const name = String(form.value.name || "").trim();
  const price = Number(form.value.price);
  const stock = Number(form.value.stock);
  if (!name || Number.isNaN(price) || price <= 0) {
    push.error(t("admin.products.validation_create"));
    return;
  }
  isSubmitting.value = true;
  try {
    const body: Record<string, unknown> = {
      name,
      description: String(form.value.description || ""),
      price,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
    };
    const cid = String(form.value.category_id || "").trim();
    if (cid) body.category_id = cid;
    const img = String(form.value.image_url || "").trim();
    if (img) body.image_url = img;
    const sid = String(form.value.seller_id || "").trim();
    if (sid) body.seller_id = sid;
    body.listing_status = form.value.listing_status;

    await adminFetch("create-product", {
      method: "POST",
      body,
    });
    push.success(t("admin.products.create_ok"));
    await navigateTo(localePath("/admin/products"));
  } catch (e: any) {
    push.error(
      e?.data?.error?.message || e?.message || t("admin.products.create_fail")
    );
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
        {{ t("admin.products.new_title") }}
      </h1>
      <NuxtLink
        :to="localePath('/admin/products')"
        class="text-sm text-alizarin-crimson-600 hover:underline mt-2 inline-block"
      >
        ← {{ t("admin.products.back_list") }}
      </NuxtLink>
    </div>

    <UCard>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormGroup :label="t('admin.products.form_name')" required>
          <UInput v-model="form.name" />
        </UFormGroup>
        <UFormGroup :label="t('admin.products.form_description')">
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-alizarin-crimson-500"
          />
        </UFormGroup>
        <UFormGroup :label="t('admin.products.form_price')" required>
          <UInput v-model="form.price" type="number" step="0.01" min="0" />
        </UFormGroup>
        <UFormGroup :label="t('admin.products.form_stock')">
          <UInput v-model="form.stock" type="number" min="0" />
        </UFormGroup>
        <UFormGroup :label="t('admin.products.form_image_url')">
          <UInput v-model="form.image_url" type="url" />
        </UFormGroup>
        <UFormGroup :label="t('admin.products.form_category_id')">
          <UInput v-model="form.category_id" placeholder="UUID (optional)" />
        </UFormGroup>
        <UFormGroup :label="t('admin.products.form_seller_id')">
          <UInput v-model="form.seller_id" placeholder="UUID (optional)" />
        </UFormGroup>
        <UFormGroup :label="t('admin.products.form_listing_status')">
          <select
            v-model="form.listing_status"
            class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white"
          >
            <option value="pending_review">
              {{ t("admin.products.listing_pending_review") }}
            </option>
            <option value="published">
              {{ t("admin.products.listing_published") }}
            </option>
            <option value="hidden">
              {{ t("admin.products.listing_hidden") }}
            </option>
          </select>
        </UFormGroup>
        <div class="flex gap-2">
          <UButton type="submit" color="red" :loading="isSubmitting">
            {{ t("admin.products.save_create") }}
          </UButton>
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            :to="localePath('/admin/products')"
          >
            {{ t("admin.products.cancel") }}
          </UButton>
        </div>
      </form>
    </UCard>
  </div>
</template>
