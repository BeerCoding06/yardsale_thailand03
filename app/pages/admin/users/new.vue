<script setup lang="ts">
import { push } from "notivue";

definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const localePath = useLocalePath();
const { adminFetch } = useAdminFetch();

const form = ref({
  email: "",
  password: "",
  name: "",
  role: "user" as "user" | "seller" | "admin",
  account_status: "public" as "public" | "pending" | "block",
});

const isSubmitting = ref(false);

const roleOptions = computed(() => [
  { value: "user" as const, label: t("admin.users.role_customer") },
  { value: "seller" as const, label: t("admin.users.role_seller") },
  { value: "admin" as const, label: t("admin.users.role_admin") },
]);

const statusOptions = computed(() => [
  { value: "public" as const, label: t("admin.users.status_public") },
  { value: "pending" as const, label: t("admin.users.status_pending") },
  { value: "block" as const, label: t("admin.users.status_block") },
]);

function extractApiError(e: any): string {
  const d = e?.data ?? e?.response?._data;
  if (typeof d?.error === "string") return d.error;
  if (d?.error?.message) return String(d.error.message);
  if (d?.message) return String(d.message);
  if (e?.data?.error?.message) return String(e.data.error.message);
  if (e?.message) return String(e.message);
  return "";
}

function isCreateUserFailure(res: any): string | null {
  if (!res || typeof res !== "object") return null;
  const inner = res.data !== undefined && typeof res.data === "object" ? res.data : res;
  if (res.success === false || inner.success === false) {
    const msg =
      inner?.error?.message ||
      res?.error?.message ||
      (typeof inner?.error === "string" ? inner.error : null) ||
      (typeof res?.error === "string" ? res.error : null);
    return msg ? String(msg) : "error";
  }
  return null;
}

async function onSubmit() {
  if (!form.value.email?.trim() || !form.value.password) {
    push.error(t("admin.users.validation_required"));
    return;
  }
  if (form.value.password.length < 8) {
    push.error(t("admin.users.password_min"));
    return;
  }

  isSubmitting.value = true;
  try {
    const body: Record<string, unknown> = {
      email: form.value.email.trim(),
      password: form.value.password,
      role: form.value.role,
      account_status: form.value.account_status,
      username: form.value.email.trim().split("@")[0] || form.value.email.trim(),
    };
    if (form.value.name?.trim()) {
      body.name = form.value.name.trim();
    }

    const res = await adminFetch<any>("create-user", {
      method: "POST",
      body,
    });

    const failMsg = isCreateUserFailure(res);
    if (failMsg) {
      push.error(failMsg === "error" ? t("admin.users.create_failed") : failMsg);
      return;
    }

    push.success(t("admin.users.created"));
    await navigateTo(localePath("/admin/users"));
  } catch (e: any) {
    const msg = extractApiError(e) || t("admin.users.create_failed");
    push.error(String(msg));
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto space-y-6">
    <div>
      <NuxtLink
        :to="localePath('/admin/users')"
        class="inline-flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-alizarin-crimson-600 dark:hover:text-alizarin-crimson-400 mb-3"
      >
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
        {{ t("admin.users.back_to_list") }}
      </NuxtLink>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
        {{ t("admin.users.form_title") }}
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400 mt-1 text-sm">
        {{ t("admin.users.create_page_lead") }}
      </p>
    </div>

    <UCard>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormGroup :label="t('admin.users.email')" required>
          <UInput v-model="form.email" type="email" autocomplete="email" />
        </UFormGroup>
        <UFormGroup :label="t('admin.users.password')" required>
          <UInput v-model="form.password" type="password" autocomplete="new-password" />
        </UFormGroup>
        <UFormGroup :label="t('admin.users.display_name')">
          <UInput v-model="form.name" autocomplete="name" />
        </UFormGroup>
        <UFormGroup :label="t('admin.users.role')" required>
          <select
            v-model="form.role"
            class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-alizarin-crimson-500"
          >
            <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </UFormGroup>
        <UFormGroup :label="t('admin.users.account_status')" required>
          <select
            v-model="form.account_status"
            class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-alizarin-crimson-500"
          >
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </UFormGroup>
        <div class="flex flex-col sm:flex-row gap-2 pt-2">
          <UButton
            type="submit"
            color="red"
            class="justify-center flex-1"
            :loading="isSubmitting"
          >
            {{ t("admin.users.submit") }}
          </UButton>
          <UButton
            type="button"
            variant="soft"
            color="neutral"
            class="justify-center"
            :to="localePath('/admin/users')"
          >
            {{ t("admin.users.cancel") }}
          </UButton>
        </div>
      </form>
    </UCard>
  </div>
</template>
