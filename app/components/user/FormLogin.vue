<!--app/components/user/FormLogin.vue-->
<script setup>
const form = ref({
  username: "",
  password: "",
  remember: false,
});
const isSubmitting = ref(false);
const message = ref(null);
const showPassword = ref(false);
const errors = ref({
  username: "",
  password: "",
});

// CarouselCategories ถูกย้ายไปที่ app.vue แล้ว เพื่อแสดงในทุกหน้า

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value;
};

watch(
  () => form.value.username,
  (newVal) => {
    if (newVal && newVal.trim()) {
      errors.value.username = "";
    }
  }
);

watch(
  () => form.value.password,
  (newVal) => {
    if (newVal && newVal.trim()) {
      errors.value.password = "";
    }
  }
);

const handleSubmit = async (e) => {
  if (e) e.preventDefault();
  message.value = null;

  let hasErrors = false;
  if (!form.value.username || !form.value.username.trim()) {
    errors.value.username = "กรุณากรอกชื่อผู้ใช้หรืออีเมล";
    hasErrors = true;
  }
  if (!form.value.password || !form.value.password.trim()) {
    errors.value.password = "กรุณากรอกรหัสผ่าน";
    hasErrors = true;
  }

  if (hasErrors) {
    message.value = { type: "error", text: "กรุณาตรวจสอบข้อมูลที่กรอก" };
    return;
  }

  isSubmitting.value = true;
  try {
    const { login } = useAuth();
    const result = await login(
      form.value.username.trim(),
      form.value.password,
      form.value.remember
    );

    if (result.success) {
      message.value = {
        type: "success",
        text: "เข้าสู่ระบบสำเร็จ!",
      };

      // Wait for auth state to update and close any modals
      await nextTick();

      // Redirect to profile page after 1 second
      setTimeout(() => {
        navigateTo("/profile");
      }, 1000);
    } else {
      throw new Error(result.error || "Login failed");
    }
  } catch (error) {
    console.error("[Form] Login error:", error);

    const errorMessage = error.data?.message || error.message || "";
    const statusCode = error.data?.statusCode || error.statusCode || 0;

    if (
      statusCode === 401 ||
      errorMessage.toLowerCase().includes("incorrect") ||
      errorMessage.toLowerCase().includes("invalid") ||
      errorMessage.toLowerCase().includes("username") ||
      errorMessage.toLowerCase().includes("password")
    ) {
      message.value = {
        type: "error",
        text: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      };
      errors.value.username = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
      errors.value.password = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
    } else {
      message.value = {
        type: "error",
        text: errorMessage || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ",
      };
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div>
    <div class="max-w-4xl mx-auto p-6">
      <h1
        class="text-3xl font-bold mb-2 text-black dark:text-white text-center"
      >
        เข้าสู่ระบบ
      </h1>

      <form @submit.prevent="handleSubmit" class="space-y-6 mt-5">
        <div
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
        >
          <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
            ข้อมูลการเข้าสู่ระบบ
          </h2>

          <div class="space-y-4">
            <div>
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >ชื่อผู้ใช้หรืออีเมล (ต้องการ) / Username or Email
                (Required)</label
              >
              <input
                v-model="form.username"
                type="text"
                required
                :class="[
                  'w-full px-4 py-3 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors',
                  errors.username
                    ? 'border-red-500 dark:border-red-500 focus:border-red-600 dark:focus:border-red-600'
                    : 'border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600',
                ]"
                placeholder="กรอกชื่อผู้ใช้หรืออีเมล"
              />
              <p
                v-if="errors.username"
                class="text-xs text-red-500 dark:text-red-400 mt-1"
              >
                {{ errors.username }}
              </p>
            </div>

            <div>
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >รหัสผ่าน (ต้องการ) / Password (Required)</label
              >
              <div class="relative">
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  :class="[
                    'w-full px-4 py-3 pr-12 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors',
                    errors.password
                      ? 'border-red-500 dark:border-red-500 focus:border-red-600 dark:focus:border-red-600'
                      : 'border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600',
                  ]"
                  placeholder="กรอกรหัสผ่าน"
                />
                <button
                  type="button"
                  @click="togglePasswordVisibility"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
                >
                  <UIcon
                    :name="
                      showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'
                    "
                    class="w-5 h-5"
                  />
                </button>
              </div>
              <p
                v-if="errors.password"
                class="text-xs text-red-500 dark:text-red-400 mt-1"
              >
                {{ errors.password }}
              </p>
            </div>

            <div class="flex items-center gap-3">
              <input
                v-model="form.remember"
                type="checkbox"
                class="w-5 h-5 rounded border-2 border-black dark:border-white text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
              <span class="text-sm font-medium text-black dark:text-white"
                >จดจำการเข้าสู่ระบบ</span
              >
            </div>
          </div>
        </div>

        <div
          v-if="message"
          :class="[
            'p-4 rounded-xl',
            message && message.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
          ]"
        >
          {{ message && message.text }}
        </div>

        <div
          class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <NuxtLink
            to="/register-user"
            class="text-sm text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white underline whitespace-nowrap"
          >
            ยังไม่มีบัญชี? สมัครสมาชิก
          </NuxtLink>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full sm:w-auto px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-lg hover:shadow-xl"
          >
            <span v-if="!isSubmitting">เข้าสู่ระบบ</span>
            <span
              v-else
              class="d-flex align-items-center gap-2 justify-content-center"
            >
              <UIcon
                name="i-svg-spinners-90-ring-with-bg"
                class="me-2"
                style="width: 1.25rem; height: 1.25rem"
              />
              กำลังเข้าสู่ระบบ...
            </span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
