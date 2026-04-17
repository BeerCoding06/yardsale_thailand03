<!--app/components/ButtonWishlist.vue-->
<script setup>
const props = defineProps({
  product: Object,
  /** การ์ดสินค้า: ไม่ใส่ margin ซ้าย + ขนาดเท่าปุ่มตะกร้า */
  compact: { type: Boolean, default: false },
});

const { isWishlisted, toggleWishlist } = useWishlist(props.product);
</script>

<template>
  <button
    type="button"
    class="active:scale-95 transition"
    :aria-label="$t('nav.favorites')"
    @click.stop="toggleWishlist(props.product)"
  >
    <div
      :class="[
        props.compact ? 'w-11 h-11' : 'w-12 h-12 ml-3',
        'rounded-full flex justify-center items-center shadow-md border border-neutral-200/80 dark:border-neutral-700',
        isWishlisted ? 'bg-alizarin-crimson-100 dark:bg-alizarin-crimson-950' : 'bg-white/95 dark:bg-neutral-900/95',
      ]"
    >
      <UIcon
        :name="isWishlisted ? 'i-iconamoon-heart-fill' : 'i-iconamoon-heart'"
        :size="props.compact ? 22 : 26"
        :class="isWishlisted ? 'text-alizarin-crimson-400 dark:text-alizarin-crimson-700 pulse-heart' : 'text-neutral-900 dark:text-neutral-200'" />
    </div>
  </button>
</template>
