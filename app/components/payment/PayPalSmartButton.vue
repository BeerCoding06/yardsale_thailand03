<!-- PayPal Smart Payment Buttons – create/capture ผ่าน Nuxt server API -->
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    woocommerceOrderId: number;
    amount: number | string;
    currency?: string;
    disabled?: boolean;
  }>(),
  { currency: 'THB', disabled: false }
);

const emit = defineEmits<{
  success: [payload: Record<string, unknown>];
  cancel: [];
  error: [err: unknown];
  loading: [v: boolean];
}>();

const containerRef = ref<HTMLElement | null>(null);
const config = useRuntimeConfig();
const loadError = ref<string | null>(null);
let buttonsInstance: { close?: () => void } | null = null;

function loadPayPalScript(clientId: string, currency: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const w = window as Window & { paypal?: unknown };
  if (w.paypal) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-paypal-sdk]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('PayPal SDK load failed')));
      return;
    }
    const script = document.createElement('script');
    script.setAttribute('data-paypal-sdk', '1');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('PayPal SDK load failed'));
    document.head.appendChild(script);
  });
}

async function mountButtons() {
  loadError.value = null;
  if (!import.meta.client || !containerRef.value) return;
  const clientId = config.public.paypalClientId as string;
  if (!clientId) {
    loadError.value = 'PayPal Client ID not configured (NUXT_PUBLIC_PAYPAL_CLIENT_ID)';
    return;
  }
  if (props.disabled || !props.woocommerceOrderId || props.woocommerceOrderId < 1) {
    return;
  }

  emit('loading', true);
  try {
    await loadPayPalScript(clientId, props.currency || 'THB');
    const w = window as Window & {
      paypal?: { Buttons: (opts: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void>; close?: () => void } };
    };
    if (!w.paypal) {
      throw new Error('PayPal SDK not available');
    }
    containerRef.value.innerHTML = '';
    buttonsInstance = w.paypal.Buttons({
      style: {
        layout: 'vertical',
        shape: 'rect',
        label: 'paypal',
      },
      createOrder: async () => {
        const res = await $fetch<{ id: string }>('/api/paypal-create-order', {
          method: 'POST',
          body: {
            woocommerce_order_id: props.woocommerceOrderId,
            amount: props.amount,
            currency: props.currency || 'THB',
          },
        });
        return res.id;
      },
      onApprove: async (data: { orderID: string }) => {
        emit('loading', true);
        try {
          const result = await $fetch('/api/paypal-capture-order', {
            method: 'POST',
            body: { orderID: data.orderID },
          });
          emit('success', result as Record<string, unknown>);
        } catch (e) {
          emit('error', e);
        } finally {
          emit('loading', false);
        }
      },
      onCancel: () => {
        emit('cancel');
      },
      onError: (err: unknown) => {
        emit('error', err);
      },
    });
    await buttonsInstance.render(containerRef.value as HTMLElement);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
    emit('error', e);
  } finally {
    emit('loading', false);
  }
}

onMounted(() => {
  nextTick(() => mountButtons());
});

watch(
  () => [props.woocommerceOrderId, props.amount, props.currency, props.disabled] as const,
  () => {
    if (containerRef.value) {
      containerRef.value.innerHTML = '';
    }
    if (buttonsInstance?.close) {
      try {
        buttonsInstance.close();
      } catch {
        /* ignore */
      }
    }
    buttonsInstance = null;
    nextTick(() => mountButtons());
  }
);

onUnmounted(() => {
  if (buttonsInstance?.close) {
    try {
      buttonsInstance.close();
    } catch {
      /* ignore */
    }
  }
});
</script>

<template>
  <div class="paypal-smart-button">
    <p v-if="loadError" class="text-sm text-red-600 dark:text-red-400 mb-2">{{ loadError }}</p>
    <div ref="containerRef" class="min-h-[45px]" />
  </div>
</template>
