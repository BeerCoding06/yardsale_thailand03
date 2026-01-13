<!--app/components/user/UserProfile.vue-->
<script setup>
const auth = useAuth();
const { user, isAuthenticated, logout, checkAuth } = auth;
const router = useRouter();
const { t } = useI18n();

// Client-side only state to prevent hydration mismatch
const isClient = ref(false);
const showContent = computed(
  () => isClient.value && isAuthenticated.value && user.value
);

// Profile editing states
const isEditingProfile = ref(false);
const profileForm = ref({
  first_name: "",
  last_name: "",
  display_name: "",
  email: "",
});
const profilePicture = ref(null);
const profilePicturePreview = ref(null);
const profilePictureFile = ref(null);
const profilePictureInput = ref(null);
const isLoading = ref(false);
const message = ref(null);
const errors = ref({});

// Redirect to login if not authenticated (client-side only)
onMounted(() => {
  isClient.value = true;
  if (!isAuthenticated.value) {
    router.push("/login");
  } else {
    loadProfileData();
  }
});

// Load profile data
const loadProfileData = () => {
  if (user.value) {
    profileForm.value = {
      first_name: user.value.first_name || "",
      last_name: user.value.last_name || "",
      display_name: user.value.name || user.value.display_name || "",
      email: user.value.email || "",
    };

    // Load profile picture if exists
    if (user.value.profile_picture_url) {
      profilePicturePreview.value = user.value.profile_picture_url;
    } else if (user.value.profile_picture_id) {
      // Try to load from attachment ID if URL not available
      loadProfilePicture();
    }
  }
};

// Load profile picture
const loadProfilePicture = async () => {
  // This will be implemented when we add API to get profile picture
  // For now, we'll use placeholder
};

// Watch for user changes
watch(
  user,
  (newUser) => {
    if (newUser) {
      loadProfileData();
      // Update profile picture preview when user changes
      if (newUser.profile_picture_url) {
        profilePicturePreview.value = newUser.profile_picture_url;
      }
    }
  },
  { deep: true, immediate: true }
);

// Handle profile picture selection
const handleProfilePictureSelect = async (event) => {
  const file = event.target.files[0];
  if (file) {
    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      message.value = {
        type: "error",
        text: t("profile.select_image"),
      };
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      message.value = { type: "error", text: t("profile.file_too_large") };
      return;
    }

    profilePictureFile.value = file;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      profilePicturePreview.value = e.target.result;
    };
    reader.readAsDataURL(file);

    // Upload immediately after selection
    await uploadProfilePicture();
  }
};

// Upload profile picture
const uploadProfilePicture = async () => {
  if (!profilePictureFile.value) return;

  try {
    isLoading.value = true;
    message.value = null;
    errors.value = {};

    const formData = new FormData();
    formData.append("profile_picture", profilePictureFile.value);
    formData.append("user_id", String(user.value.id || user.value.ID));

    const response = await $fetch("/api/upload-profile-picture", {
      method: "POST",
      body: formData,
    });

    if (response.success) {
      message.value = { type: "success", text: t("profile.picture_uploaded") };

      // Update profile picture preview immediately
      profilePicturePreview.value = response.image_url;

      // Update user in localStorage
      if (import.meta.client && user.value) {
        const updatedUser = {
          ...user.value,
          profile_picture_id: response.attachment_id,
          profile_picture_url: response.image_url,
        };
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      // Clear the file input
      profilePictureFile.value = null;

      // Reload auth to get updated user data
      await checkAuth();

      // Ensure preview is set after auth reload
      await nextTick();
      if (user.value?.profile_picture_url) {
        profilePicturePreview.value = user.value.profile_picture_url;
      } else {
        profilePicturePreview.value = response.image_url;
      }
    }
  } catch (error) {
    console.error("[UserProfile] Upload error:", error);
    message.value = {
      type: "error",
      text:
        error.data?.message ||
        error.message ||
        t("profile.upload_error"),
    };
  } finally {
    isLoading.value = false;
  }
};

// Update profile
const updateProfile = async () => {
  try {
    isLoading.value = true;
    message.value = null;
    errors.value = {};

    const response = await $fetch("/api/update-profile", {
      method: "POST",
      body: {
        user_id: user.value.id || user.value.ID,
        first_name: profileForm.value.first_name,
        last_name: profileForm.value.last_name,
        display_name: profileForm.value.display_name,
        email: profileForm.value.email,
      },
    });

    if (response.success) {
      message.value = { type: "success", text: t("profile.profile_updated") };
      isEditingProfile.value = false;

      // Update user in localStorage
      if (import.meta.client && user.value && response.user) {
        const updatedUser = {
          ...user.value,
          ...response.user,
        };
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      // Reload auth to get updated user data from server
      await checkAuth();

      // Reload profile form with updated data
      await nextTick();
      loadProfileData();
    }
  } catch (error) {
    console.error("[UserProfile] Update error:", error);
    const errorMessage =
      error.data?.message ||
      error.message ||
      t("profile.update_error");
    message.value = { type: "error", text: errorMessage };

    // Set field-specific errors if available
    if (error.data?.details) {
      errors.value = error.data.details;
    }
  } finally {
    isLoading.value = false;
  }
};

// CarouselCategories ถูกย้ายไปที่ app.vue แล้ว เพื่อแสดงในทุกหน้า
</script>

<template>
  <div>
    <div class="max-w-4xl mx-auto p-6">
      <h1
        class="text-3xl font-bold mb-6 text-black dark:text-white text-center"
      >
        {{ $t("profile.user_profile") }}
      </h1>

      <ClientOnly>
        <template v-if="showContent">
          <div class="space-y-6">
            <!-- User Info Card -->
            <div
              class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
            >
              <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
                {{ $t("profile.user_info") }}
              </h2>

              <div class="space-y-4">
                <!-- Profile Picture Section -->
                <div class="flex items-center gap-4">
                  <div class="relative">
                    <div
                      v-if="profilePicturePreview || user.profile_picture_url"
                      class="w-24 h-24 rounded-full overflow-hidden border-2 border-neutral-200 dark:border-neutral-700"
                    >
                      <img
                        :src="profilePicturePreview || user.profile_picture_url"
                        :alt="
                          user.first_name && user.last_name
                            ? `${user.first_name} ${user.last_name}`
                            : user.name || user.username
                        "
                        class="w-full h-full object-cover"
                      />
                    </div>
                    <div
                      v-else
                      class="w-24 h-24 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center"
                    >
                      <UIcon
                        name="i-heroicons-user-circle"
                        class="w-14 h-14 text-black dark:text-white"
                      />
                    </div>
                    <label
                      class="absolute bottom-0 right-0 w-10 h-10 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg border-2 border-white dark:border-black"
                      :title="$t('profile.change_profile_picture')"
                      @click.prevent="profilePictureInput?.click()"
                    >
                      <UIcon
                        name="i-heroicons-camera"
                        class="w-5 h-5 text-white"
                      />
                    </label>
                  </div>
                  <div class="flex-1">
                    <p class="text-2xl font-bold text-black dark:text-white">
                      {{
                        user.first_name && user.last_name
                          ? `${user.first_name} ${user.last_name}`
                          : user.first_name
                          ? user.first_name
                          : user.last_name
                          ? user.last_name
                          :                             user.name ||
                            user.display_name ||
                            user.username ||
                            $t("profile.user")
                      }}
                    </p>
                    <p class="text-sm text-neutral-500 dark:text-neutral-400">
                      {{ user.email }}
                    </p>
                    <div
                      v-if="isLoading"
                      class="mt-2 px-4 py-2 text-sm bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-lg font-semibold inline-block"
                    >
                      {{ $t("profile.uploading") }}
                    </div>
                  </div>
                </div>

                <!-- Hidden file input for direct click -->
                <input
                  ref="profilePictureInput"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  class="hidden"
                  @change="handleProfilePictureSelect"
                />

                <!-- Message Display -->
                <div
                  v-if="message"
                  :class="[
                    'p-4 rounded-xl',
                    message.type === 'success'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
                  ]"
                >
                  {{ message.text }}
                </div>

                <!-- Edit Profile Form -->
                <div
                  v-if="isEditingProfile"
                  class="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-4"
                >
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        class="block text-sm font-medium mb-2 text-black dark:text-white"
                      >
                        {{ $t("profile.first_name") }}
                      </label>
                      <input
                        v-model="profileForm.first_name"
                        type="text"
                        class="w-full px-4 py-2 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white focus:outline-none"
                        :placeholder="$t('profile.first_name')"
                      />
                    </div>
                    <div>
                      <label
                        class="block text-sm font-medium mb-2 text-black dark:text-white"
                      >
                        {{ $t("profile.last_name") }}
                      </label>
                      <input
                        v-model="profileForm.last_name"
                        type="text"
                        class="w-full px-4 py-2 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white focus:outline-none"
                        :placeholder="$t('profile.last_name')"
                      />
                    </div>
                    <div>
                      <label
                        class="block text-sm font-medium mb-2 text-black dark:text-white"
                      >
                        {{ $t("profile.display_name") }}
                      </label>
                      <input
                        v-model="profileForm.display_name"
                        type="text"
                        class="w-full px-4 py-2 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white focus:outline-none"
                        :placeholder="$t('profile.display_name')"
                      />
                    </div>
                    <div>
                      <label
                        class="block text-sm font-medium mb-2 text-black dark:text-white"
                      >
                        {{ $t("profile.email") }}
                      </label>
                      <input
                        v-model="profileForm.email"
                        type="email"
                        class="w-full px-4 py-2 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white focus:outline-none"
                        :placeholder="$t('profile.email')"
                      />
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      @click="updateProfile"
                      :disabled="isLoading"
                      class="px-6 py-2 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg disabled:opacity-50"
                    >
                      {{ isLoading ? $t("profile.saving") : $t("profile.save_changes") }}
                    </button>
                    <button
                      @click="isEditingProfile = false"
                      :disabled="isLoading"
                      class="px-6 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition disabled:opacity-50"
                    >
                      {{ $t("profile.cancel") }}
                    </button>
                  </div>
                </div>

                <!-- Display Profile Info -->
                <div
                  v-else
                  class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800"
                >
                  <div>
                    <p
                      class="text-sm text-neutral-500 dark:text-neutral-400 mb-1"
                    >
                      {{ $t("profile.username") }}
                    </p>
                    <p class="font-medium text-black dark:text-white">
                      {{ user.username }}
                    </p>
                  </div>
                  <div>
                    <p
                      class="text-sm text-neutral-500 dark:text-neutral-400 mb-1"
                    >
                      {{ $t("profile.email") }}
                    </p>
                    <p class="font-medium text-black dark:text-white">
                      {{ user.email }}
                    </p>
                  </div>
                  <div v-if="user.first_name || user.last_name">
                    <p
                      class="text-sm text-neutral-500 dark:text-neutral-400 mb-1"
                    >
                      {{ $t("profile.full_name") }}
                    </p>
                    <p class="font-medium text-black dark:text-white">
                      {{
                        (user.first_name || "") + " " + (user.last_name || "")
                      }}
                    </p>
                  </div>
                  <div v-if="user.roles && user.roles.length > 0">
                    <p
                      class="text-sm text-neutral-500 dark:text-neutral-400 mb-1"
                    >
                      {{ $t("profile.role") }}
                    </p>
                    <div class="flex gap-2">
                      <span
                        v-for="role in user.roles"
                        :key="role"
                        class="px-3 py-1 bg-black/10 dark:bg-white/10 rounded-full text-sm font-medium text-black dark:text-white"
                      >
                        {{ role }}
                      </span>
                    </div>
                  </div>
                  <div class="md:col-span-2">
                    <button
                      @click="isEditingProfile = true"
                      class="px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg flex items-center gap-2"
                    >
                      <UIcon name="i-heroicons-pencil" class="w-5 h-5" />
                      {{ $t("profile.edit_profile") }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions Card -->
            <div
              class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
            >
              <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
                {{ $t("profile.menu") }}
              </h2>

              <div class="space-y-2">
                <NuxtLink
                  to="/create-product"
                  class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition text-black dark:text-white border-2 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                >
                  <UIcon name="i-heroicons-plus-circle" class="w-5 h-5" />
                  <span class="font-medium">{{ $t("auth.create_product") }}</span>
                </NuxtLink>
                <!-- INSERT_YOUR_CODE -->
                <NuxtLink
                  to="/my-products"
                  class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition text-black dark:text-white border-2 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                >
                  <UIcon name="i-heroicons-cube-transparent" class="w-5 h-5" />
                  <span class="font-medium">{{ $t("auth.my_products") }}</span>
                </NuxtLink>
                <NuxtLink
                  to="/my-orders"
                  class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition text-black dark:text-white border-2 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                >
                  <UIcon name="i-heroicons-shopping-bag" class="w-5 h-5" />
                  <span class="font-medium">{{ $t("auth.my_orders") }}</span>
                </NuxtLink>
                <NuxtLink
                  to="/seller-orders"
                  class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition text-black dark:text-white border-2 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                >
                  <UIcon name="i-heroicons-credit-card" class="w-5 h-5" />
                  <span class="font-medium">{{ $t("auth.seller_orders") }}</span>
                </NuxtLink>
                <button
                  @click="logout"
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition text-red-600 dark:text-red-400 border-2 border-transparent hover:border-red-200 dark:hover:border-red-800"
                >
                  <UIcon
                    name="i-heroicons-arrow-right-on-rectangle"
                    class="w-5 h-5"
                  />
                  <span class="font-medium">{{ $t("auth.logout") }}</span>
                </button>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="text-center py-12">
            <p class="text-neutral-500 dark:text-neutral-400">
              {{ $t("profile.please_login") }}
            </p>
            <NuxtLink
              to="/login"
              class="inline-block mt-4 px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
            >
              {{ $t("auth.login") }}
            </NuxtLink>
          </div>
        </template>
        <template #fallback>
          <div class="text-center py-12">
            <p class="text-neutral-500 dark:text-neutral-400">{{ $t("general.loading") }}</p>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
