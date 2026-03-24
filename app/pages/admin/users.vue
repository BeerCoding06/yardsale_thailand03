<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const { checkAuth } = useAuth();
const { adminFetch } = useAdminFetch();
const { push } = useNotivue();

const form = ref({
  email: "",
  password: "",
  name: "",
  role: "user" as "user" | "seller" | "admin",
});

const isSubmitting = ref(false);
const isLoadingList = ref(true);
const usersList = ref<any[]>([]);

const roleOptions = computed(() => [
  { value: "user" as const, label: t("admin.users.role_customer") },
  { value: "seller" as const, label: t("admin.users.role_seller") },
  { value: "admin" as const, label: t("admin.users.role_admin") },
]);

function pickUsers(res: any): any[] {
  const inner = res?.data && typeof res.data === "object" ? res.data : res;
  if (Array.isArray(inner?.users)) return inner.users;
  if (Array.isArray(res?.users)) return res.users;
  return [];
}

async function loadUsers() {
  isLoadingList.value = true;
  try {
    const res = await adminFetch<any>("admin/users");
    usersList.value = pickUsers(res);
  } catch (e: any) {
    usersList.value = [];
    const status = e?.statusCode ?? e?.status ?? e?.response?.status;
    const msg = extractApiError(e);
    if (status === 403 || status === 401) {
      push.error(t("admin.users.load_forbidden"));
    } else if (msg) {
      push.error(msg);
    } else {
      push.error(t("admin.users.load_failed"));
    }
  } finally {
    isLoadingList.value = false;
  }
}

function extractApiError(e: any): string {
  const d = e?.data ?? e?.response?._data;
  if (typeof d?.error === "string") return d.error;
  if (d?.error?.message) return String(d.error.message);
  if (d?.message) return String(d.message);
  if (e?.data?.error?.message) return String(e.data.error.message);
  if (e?.message) return String(e.message);
  return "";
}

/** รองรับทั้ง Express (ห่อ data) และ mock ที่คืน success บน root */
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
    form.value = {
      email: "",
      password: "",
      name: "",
      role: "user",
    };
    await loadUsers();
  } catch (e: any) {
    const msg =
      extractApiError(e) || t("admin.users.create_failed");
    push.error(String(msg));
  } finally {
    isSubmitting.value = false;
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateString));
};

onMounted(() => {
  checkAuth();
  loadUsers();
});
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-10">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
        {{ t("admin.users.title") }}
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400 mt-1 text-sm">
        {{ t("admin.users.lead") }}
      </p>
    </div>

    <UCard>
      <h2 class="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
        {{ t("admin.users.list_heading") }}
      </h2>
      <div v-if="isLoadingList" class="py-8 text-center text-neutral-500">
        {{ t("general.loading") }}
      </div>
      <div v-else-if="!usersList.length" class="py-8 text-center text-neutral-500">
        {{ t("admin.users.list_empty") }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead>
            <tr class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400">
              <th class="py-2 pr-4 font-medium">{{ t("admin.users.list_col_email") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.users.list_col_name") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.users.list_col_role") }}</th>
              <th class="py-2 font-medium">{{ t("admin.users.list_col_created") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in usersList"
              :key="u.id"
              class="border-b border-neutral-100 dark:border-neutral-800"
            >
              <td class="py-3 pr-4">{{ u.email }}</td>
              <td class="py-3 pr-4">{{ u.name || "—" }}</td>
              <td class="py-3 pr-4 capitalize">{{ u.role }}</td>
              <td class="py-3 text-neutral-600 dark:text-neutral-400">
                {{ formatDate(u.created_at || "") }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <div class="max-w-lg mx-auto">
      <h2 class="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
        {{ t("admin.users.form_title") }}
      </h2>
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
              <option
                v-for="opt in roleOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </UFormGroup>
          <UButton
            type="submit"
            color="red"
            block
            :loading="isSubmitting"
            class="justify-center"
          >
            {{ t("admin.users.submit") }}
          </UButton>
        </form>
      </UCard>
    </div>
  </div>
</template>
