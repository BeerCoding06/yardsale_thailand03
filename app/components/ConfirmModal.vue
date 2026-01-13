<!--app/components/ConfirmModal.vue-->
<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  message: {
    type: String,
    default: '',
  },
  confirmText: {
    type: String,
    default: 'ยืนยัน',
  },
  cancelText: {
    type: String,
    default: 'ยกเลิก',
  },
  confirmColor: {
    type: String,
    default: 'red', // red, blue, green, etc.
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const handleConfirm = () => {
  emit('confirm');
};

const handleCancel = () => {
  emit('cancel');
  isOpen.value = false;
};

const confirmButtonClass = computed(() => {
  const colorMap = {
    red: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
    blue: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
    green: 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
    orange: 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600',
  };
  return colorMap[props.confirmColor] || colorMap.red;
});
</script>

<template>
  <UModal
    v-model="isOpen"
    :ui="{
      overlay: {
        background: 'bg-black/50 dark:bg-black/70 backdrop-blur-sm',
      },
      background: 'bg-white dark:bg-neutral-900',
      container: 'items-center',
      shadow: 'shadow-2xl',
      width: 'w-full sm:max-w-md',
      rounded: 'rounded-2xl',
    }"
  >
    <div class="p-6">
      <!-- Title -->
      <div v-if="title" class="mb-4">
        <h3 class="text-xl font-bold text-neutral-900 dark:text-white">
          {{ title }}
        </h3>
      </div>

      <!-- Message -->
      <div v-if="message" class="mb-6">
        <p class="text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {{ message }}
        </p>
      </div>

      <!-- Buttons -->
      <div class="flex gap-3 justify-end">
        <button
          @click="handleCancel"
          :disabled="loading"
          class="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-300 dark:hover:bg-neutral-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ cancelText }}
        </button>
        <button
          @click="handleConfirm"
          :disabled="loading"
          :class="[
            'px-4 py-2 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2',
            confirmButtonClass,
          ]"
        >
          <UIcon
            v-if="loading"
            name="i-svg-spinners-90-ring-with-bg"
            class="w-4 h-4"
          />
          {{ confirmText }}
        </button>
      </div>
    </div>
  </UModal>
</template>

