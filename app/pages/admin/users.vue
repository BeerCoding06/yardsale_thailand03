<script setup lang="ts">
import { push } from "notivue";
import { pickPagination, paginationQuery } from "~/utils/paginationResponse";

definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const { user: authUser, checkAuth } = useAuth();
const { adminFetch } = useAdminFetch();

const form = ref({
  email: "",
  password: "",
  name: "",
  role: "user" as "user" | "seller" | "admin",
  account_status: "public" as "public" | "pending" | "block",
});

const editOpen = ref(false);
const editSaving = ref(false);
const editForm = ref({
  id: "",
  email: "",
  name: "",
  role: "user" as "user" | "seller" | "admin",
  account_status: "public" as "public" | "pending" | "block",
  password: "",
});

const deleteOpen = ref(false);
const deleteTarget = ref<{ id: string; email: string } | null>(null);
const deleteLoading = ref(false);

const isSubmitting = ref(false);
const isLoadingList = ref(true);
const usersList = ref<any[]>([]);

const USER_PAGE_SIZE = 25;
const listPage = ref(1);
const listSearch = ref("");
const listPagination = ref({
  page: 1,
  page_size: USER_PAGE_SIZE,
  total: 0,
  total_pages: 0,
});

function onUserSearch(q: string) {
  const tq = String(q || "").trim();
  if (tq === listSearch.value) return;
  listSearch.value = tq;
  listPage.value = 1;
  loadUsers();
}

function onUserPage(p: number) {
  if (p === listPage.value) return;
  listPage.value = p;
  loadUsers();
}

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

function pickUsers(res: any): any[] {
  const inner = res?.data && typeof res.data === "object" ? res.data : res;
  if (Array.isArray(inner?.users)) return inner.users;
  if (Array.isArray(res?.users)) return res.users;
  return [];
}

async function loadUsers() {
  isLoadingList.value = true;
  try {
    const res = await adminFetch<any>("admin/users", {
      query: paginationQuery(listPage.value, listSearch.value, USER_PAGE_SIZE),
    });
    usersList.value = pickUsers(res);
    const inner =
      res?.success === true && res.data != null && typeof res.data === "object"
        ? res.data
        : res;
    const pg = pickPagination(inner);
    if (pg) {
      listPagination.value = pg;
    } else {
      listPagination.value = {
        page: listPage.value,
        page_size: USER_PAGE_SIZE,
        total: usersList.value.length,
        total_pages: usersList.value.length ? 1 : 0,
      };
    }
  } catch (e: any) {
    usersList.value = [];
    listPagination.value = {
      page: 1,
      page_size: USER_PAGE_SIZE,
      total: 0,
      total_pages: 0,
    };
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

function statusLabel(s: string) {
  const v = (s || "public").toLowerCase();
  if (v === "pending") return t("admin.users.status_pending");
  if (v === "block") return t("admin.users.status_block");
  return t("admin.users.status_public");
}

function openEdit(u: any) {
  editForm.value = {
    id: String(u.id),
    email: String(u.email || ""),
    name: String(u.name || ""),
    role: (["user", "seller", "admin"].includes(u.role) ? u.role : "user") as
      | "user"
      | "seller"
      | "admin",
    account_status: (["public", "pending", "block"].includes(u.account_status)
      ? u.account_status
      : "public") as "public" | "pending" | "block",
    password: "",
  };
  editOpen.value = true;
}

function closeEdit() {
  editOpen.value = false;
}

async function saveEdit() {
  if (!editForm.value.id) return;
  editSaving.value = true;
  try {
    const body: Record<string, unknown> = {
      email: editForm.value.email.trim(),
      name: editForm.value.name.trim(),
      role: editForm.value.role,
      account_status: editForm.value.account_status,
    };
    if (editForm.value.password.length >= 8) {
      body.password = editForm.value.password;
    }

    const res = await adminFetch<any>(`admin/users/${editForm.value.id}`, {
      method: "PATCH",
      body,
    });

    const fail = isCreateUserFailure(res);
    if (fail) {
      push.error(fail === "error" ? t("admin.users.update_failed") : fail);
      return;
    }

    push.success(t("admin.users.updated"));
    closeEdit();
    await loadUsers();
  } catch (e: any) {
    push.error(extractApiError(e) || t("admin.users.update_failed"));
  } finally {
    editSaving.value = false;
  }
}

function askDelete(u: any) {
  deleteTarget.value = { id: String(u.id), email: String(u.email || "") };
  deleteOpen.value = true;
}

function closeDelete() {
  deleteOpen.value = false;
  deleteTarget.value = null;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleteLoading.value = true;
  try {
    const res = await adminFetch<any>(`admin/users/${deleteTarget.value.id}`, {
      method: "DELETE",
    });
    const fail = isCreateUserFailure(res);
    if (fail) {
      push.error(fail === "error" ? t("admin.users.delete_failed") : fail);
      return;
    }
    push.success(t("admin.users.deleted"));
    closeDelete();
    await loadUsers();
  } catch (e: any) {
    push.error(extractApiError(e) || t("admin.users.delete_failed"));
  } finally {
    deleteLoading.value = false;
  }
}

function isSelfRow(u: any): boolean {
  const aid = authUser.value?.id;
  if (aid == null || u?.id == null) return false;
  return String(aid) === String(u.id);
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
    form.value = {
      email: "",
      password: "",
      name: "",
      role: "user",
      account_status: "public",
    };
    await loadUsers();
  } catch (e: any) {
    const msg = extractApiError(e) || t("admin.users.create_failed");
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
      <ListPaginationBar
        v-else
        :page="listPagination.page"
        :total-pages="listPagination.total_pages"
        :total="listPagination.total"
        :page-size="listPagination.page_size"
        :loading="isLoadingList"
        :search="listSearch"
        class="mb-4"
        @update:page="onUserPage"
        @update:search="onUserSearch"
      />
      <div v-if="!isLoadingList && !usersList.length" class="py-8 text-center text-neutral-500">
        {{
          listSearch.trim()
            ? t("admin.users.list_empty_search")
            : t("admin.users.list_empty")
        }}
      </div>
      <div v-else-if="usersList.length" class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead>
            <tr class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400">
              <th class="py-2 pr-4 font-medium">{{ t("admin.users.list_col_email") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.users.list_col_name") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.users.list_col_role") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.users.list_col_status") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.users.list_col_created") }}</th>
              <th class="py-2 font-medium text-right">{{ t("admin.users.col_actions") }}</th>
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
              <td class="py-3 pr-4">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="{
                    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200':
                      (u.account_status || 'public') === 'public',
                    'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100':
                      u.account_status === 'pending',
                    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200':
                      u.account_status === 'block',
                  }"
                >
                  {{ statusLabel(u.account_status) }}
                </span>
              </td>
              <td class="py-3 pr-4 text-neutral-600 dark:text-neutral-400">
                {{ formatDate(u.created_at || "") }}
              </td>
              <td class="py-3 text-right whitespace-nowrap space-x-2">
                <UButton size="xs" variant="soft" color="neutral" @click="openEdit(u)">
                  {{ t("admin.users.edit") }}
                </UButton>
                <UButton
                  size="xs"
                  variant="soft"
                  color="red"
                  :disabled="isSelfRow(u)"
                  @click="askDelete(u)"
                >
                  {{ t("admin.users.delete") }}
                </UButton>
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
          <UFormGroup :label="t('admin.users.account_status')" required>
            <select
              v-model="form.account_status"
              class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-alizarin-crimson-500"
            >
              <option
                v-for="opt in statusOptions"
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

    <UModal
      v-model="editOpen"
      :ui="{
        overlay: { background: 'bg-black/50 dark:bg-black/70 backdrop-blur-sm' },
        background: 'bg-white dark:bg-neutral-900',
        width: 'w-full sm:max-w-md',
        rounded: 'rounded-2xl',
      }"
    >
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">
          {{ t("admin.users.edit_title") }}
        </h3>
        <UFormGroup :label="t('admin.users.email')" required>
          <UInput v-model="editForm.email" type="email" autocomplete="email" />
        </UFormGroup>
        <UFormGroup :label="t('admin.users.display_name')">
          <UInput v-model="editForm.name" autocomplete="name" />
        </UFormGroup>
        <UFormGroup :label="t('admin.users.role')" required>
          <select
            v-model="editForm.role"
            class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
          >
            <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </UFormGroup>
        <UFormGroup :label="t('admin.users.account_status')" required>
          <select
            v-model="editForm.account_status"
            class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
          >
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </UFormGroup>
        <UFormGroup :label="t('admin.users.new_password_optional')">
          <UInput
            v-model="editForm.password"
            type="password"
            autocomplete="new-password"
            :placeholder="t('admin.users.password_placeholder_optional')"
          />
        </UFormGroup>
        <div class="flex gap-2 justify-end pt-2">
          <UButton variant="ghost" color="neutral" @click="closeEdit">
            {{ t("admin.users.cancel") }}
          </UButton>
          <UButton color="red" :loading="editSaving" @click="saveEdit">
            {{ t("admin.users.save") }}
          </UButton>
        </div>
      </div>
    </UModal>

    <ConfirmModal
      v-model="deleteOpen"
      :title="t('admin.users.delete_confirm_title')"
      :message="
        deleteTarget
          ? t('admin.users.delete_confirm', { email: deleteTarget.email })
          : ''
      "
      :confirm-text="t('admin.users.delete')"
      confirm-color="red"
      :loading="deleteLoading"
      @confirm="confirmDelete"
      @cancel="closeDelete"
    />
  </div>
</template>
