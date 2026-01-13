<!--app/components/user/FromRegister.vue-->
<!-- 
  ทำไมใช้ tailwind ไม่ได้?
  คำตอบหลักๆ มีได้หลายเหตุผล:
  1. ยังไม่ได้ติดตั้ง tailwindcss ในโปรเจกต์ หรือ config ไม่ถูกต้อง (ดู tailwind.config.js, postcss.config.js)
  2. Import tailwind directives (`@tailwind base; @tailwind components; @tailwind utilities;`) ในไฟล์ css หลักหรือไม่
  3. ตรวจสอบว่าใช้ class ของ tailwind จริง (สะกดถูก/มีในเวอร์ชัน tailwind ที่ใช้อยู่)
  4. ถ้าใช้ Nuxt หรือ Vite ต้อง restart dev server หลังเพิ่ม tailwind
  5. บางที IDE/Editor ไม่แสดง style ต้อง refresh หรือ rebuild ใหม่

  โค้ดเดิมนี้ ใช้ tailwind ได้ปกติแล้ว ถ้า tailwind-css เซ็ตถูกต้อง!
-->

<script setup>
// ตัวอย่างนี้ใช้ Tailwind CSS ในส่วนของ class ชัดเจน
// ถ้า style ไม่ทำงาน ให้ตรวจสอบตาม list ข้างบน

const form = ref({
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  send_user_notification: true,
  roles: ["customer"],
});
const isSubmitting = ref(false);
const message = ref(null);
const showPassword = ref(false);
const errors = ref({
  username: "",
  email: "",
  password: "",
});

// CarouselCategories ถูกย้ายไปที่ app.vue แล้ว เพื่อแสดงในทุกหน้า

// Email validation state
const isCheckingEmail = ref(false);
const emailCheckTimeout = ref(null);

// Debounced email check function
const checkEmailExists = async (email) => {
  if (!email || !email.trim()) {
    errors.value.email = "";
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.value.email = "";
    return;
  }

  // Clear previous timeout
  if (emailCheckTimeout.value) {
    clearTimeout(emailCheckTimeout.value);
  }

  // Debounce: wait 500ms before checking
  emailCheckTimeout.value = setTimeout(async () => {
    isCheckingEmail.value = true;
    try {
      const result = await $fetch("/api/check-email", {
        query: { email: email.trim() },
      });

      if (result && result.exists) {
        errors.value.email = "อีเมลนี้ถูกใช้งานแล้วในระบบ";
      } else {
        // Clear error if email is available
        if (errors.value.email === "อีเมลนี้ถูกใช้งานแล้วในระบบ") {
          errors.value.email = "";
        }
      }
    } catch (error) {
      console.warn("[Form] Error checking email:", error);
      // Don't show error if check fails, let backend handle it
    } finally {
      isCheckingEmail.value = false;
    }
  }, 500);
};

const generatePassword = () => {
  const length = 24;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  form.value.password = password;
  errors.value.password = "";
};
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
  () => form.value.email,
  (newVal) => {
    if (newVal && newVal.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(newVal)) {
        // Check if email exists in WordPress
        checkEmailExists(newVal);
      } else {
        // Clear error if email format is invalid (will be caught by validation)
        if (errors.value.email === "อีเมลนี้ถูกใช้งานแล้วในระบบ") {
          errors.value.email = "";
        }
      }
    } else {
      errors.value.email = "";
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
    errors.value.username = "กรุณากรอกชื่อผู้ใช้";
    hasErrors = true;
  }
  if (!form.value.email || !form.value.email.trim()) {
    errors.value.email = "กรุณากรอกอีเมล";
    hasErrors = true;
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.value.email)) {
      errors.value.email = "รูปแบบอีเมลไม่ถูกต้อง";
      hasErrors = true;
    }
  }
  if (!form.value.password || !form.value.password.trim()) {
    errors.value.password = "กรุณากรอกรหัสผ่าน";
    hasErrors = true;
  } else if (form.value.password.length < 8) {
    errors.value.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    hasErrors = true;
  }

  // ตรวจสอบอีเมลซ้ำ (ถ้ายังไม่ตรวจสอบหรือ error ยังไม่ชัดเจน)
  if (!errors.value.email && form.value.email && form.value.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(form.value.email)) {
      // ถ้ายังกำลังตรวจสอบ ให้รอสักครู่
      if (isCheckingEmail.value) {
        message.value = {
          type: "error",
          text: "กรุณารอการตรวจสอบอีเมลให้เสร็จ",
        };
        return;
      }
    }
  }

  if (hasErrors) {
    message.value = { type: "error", text: "กรุณาตรวจสอบข้อมูลที่กรอก" };
    return;
  }
  isSubmitting.value = true;
  try {
    const payload = {
      username: form.value.username.trim(),
      email: form.value.email.trim(),
      password: form.value.password,
      first_name: form.value.first_name.trim() || undefined,
      last_name: form.value.last_name.trim() || undefined,
      roles: form.value.roles,
      send_user_notification: form.value.send_user_notification,
    };
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    console.log("[Form] Sending payload:", payload);

    // Send to Nuxt API endpoint (which will call WordPress API)
    const response = await $fetch("/api/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
    });

    console.log("[Form] Response:", response);

    message.value = {
      type: "success",
      text: "สร้างผู้ใช้ WordPress สำเร็จ!",
    };

    setTimeout(() => {
      form.value = {
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        password: "",
        send_user_notification: true,
        roles: ["customer"],
      };
      errors.value = {
        username: "",
        email: "",
        password: "",
      };
      message.value = null;
    }, 2000);
  } catch (error) {
    console.error("[Form] Error:", error);

    // ตรวจสอบว่า error เกี่ยวกับอีเมลซ้ำหรือไม่
    const errorMessage = error.data?.message || error.message || "";
    const statusCode = error.data?.statusCode || error.statusCode || 0;

    if (
      statusCode === 409 ||
      errorMessage.includes("อีเมลนี้ถูกใช้งานแล้ว") ||
      errorMessage.includes("email") ||
      errorMessage.includes("Email") ||
      errorMessage.toLowerCase().includes("already exists") ||
      errorMessage.toLowerCase().includes("existing")
    ) {
      message.value = {
        type: "error",
        text: "เกิดข้อผิดพลาดอาจเกิดจาก อีเมลนี้ได้มีผู้ใช้ในระบบแล้ว",
      };
      // แสดง error ที่ email field ด้วย
      errors.value.email = "อีเมลนี้ถูกใช้งานแล้วในระบบ";
    } else {
      message.value = {
        type: "error",
        text: errorMessage || "เกิดข้อผิดพลาดในการสร้างผู้ใช้ WordPress",
      };
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <!-- 
    ถ้า tailwind ไม่ขึ้น ให้ดูที่ไฟล์หลักที่ import css ด้วย เช่นใน nuxt3 ให้ดูที่ nuxt.config หรือ main.css/main.postcss ว่ามี @tailwind อยู่มั้ย 
  -->
  <div>
    <div class="max-w-4xl mx-auto p-6">
      <h1
        class="text-3xl font-bold mb-2 text-black dark:text-white text-center"
      >
        สมัครสมาชิก
      </h1>

      <!-- ทำไมไม่ทำงาน -->
      <form @submit.prevent="handleSubmit" class="space-y-6 mt-5">
        <div
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
        >
          <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
            ข้อมูลผู้ใช้
          </h2>

          <div class="space-y-4">
            <div>
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >ชื่อผู้ใช้ (ต้องการ) / Username (Required)</label
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
                placeholder="กรอกชื่อผู้ใช้"
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
                >อีเมล (ต้องการ) / Email (Required)</label
              >
              <div class="relative">
                <input
                  v-model="form.email"
                  type="email"
                  required
                  :class="[
                    'w-full px-4 py-3 pr-12 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors',
                    errors.email
                      ? 'border-red-500 dark:border-red-500 focus:border-red-600 dark:focus:border-red-600'
                      : 'border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600',
                  ]"
                  placeholder="example@email.com"
                />
                <div
                  v-if="isCheckingEmail"
                  class="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <UIcon
                    name="i-svg-spinners-90-ring-with-bg"
                    class="w-5 h-5 text-neutral-400"
                  />
                </div>
              </div>
              <p
                v-if="errors.email"
                class="text-xs text-red-500 dark:text-red-400 mt-1"
              >
                {{ errors.email }}
              </p>
              <p
                v-else-if="isCheckingEmail"
                class="text-xs text-neutral-500 dark:text-neutral-400 mt-1"
              >
                กำลังตรวจสอบอีเมล...
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  class="block text-sm font-medium mb-2 text-black dark:text-white"
                  >ชื่อ / First Name</label
                >
                <input
                  v-model="form.first_name"
                  type="text"
                  class="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-black/20 text-black dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
                  placeholder="ชื่อ"
                />
              </div>

              <div>
                <label
                  class="block text-sm font-medium mb-2 text-black dark:text-white"
                  >นามสกุล / Last Name</label
                >
                <input
                  v-model="form.last_name"
                  type="text"
                  class="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-black/20 text-black dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
                  placeholder="นามสกุล"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
        >
          <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
            รหัสผ่าน / Password
          </h2>

          <div class="space-y-4">
            <div class="flex gap-2">
              <button
                type="button"
                @click="generatePassword"
                class="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors text-sm font-medium"
              >
                สร้างรหัสผ่าน
              </button>
            </div>

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
                placeholder="รหัสผ่าน"
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

            <div
              v-if="form.password && form.password.length >= 8"
              class="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
            >
              <p class="text-xs text-green-700 dark:text-green-300">
                ปลอดภัยสูง
              </p>
            </div>

            <p
              v-if="errors.password"
              class="text-xs text-red-500 dark:text-red-400 mt-1"
            >
              เกิดข้อผิดพลาดอีเมล์นี้อาจถูกสร้างในระบบแล้ว
            </p>
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

        <div class="flex justify-end gap-4">
          <button
            type="submit"
            :disabled="isSubmitting"
            class="px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            <span v-if="!isSubmitting">ส่งข้อมูล</span>
            <span
              v-else
              class="d-flex align-items-center gap-2 justify-content-center"
            >
              <UIcon
                name="i-svg-spinners-90-ring-with-bg"
                class="me-2"
                style="width: 1.25rem; height: 1.25rem"
              />
              กำลังสร้าง...
            </span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
