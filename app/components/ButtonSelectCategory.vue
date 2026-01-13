<!--app/components/ButtonSelectCategory.vue-->
<script setup>
const categoriesData = ref([]);

// โหลด categories เมื่อ component ถูก mount
onMounted(async () => {
  try {
    const response = await $fetch("/api/categories");
    // กรองหมวดหมู่ที่มีสินค้า หรือมีหมวดย่อย
    categoriesData.value = response.productCategories.nodes.filter(
      (category) =>
        category.products?.nodes?.length > 0 ||
        category.children?.nodes?.length > 0
    );
  } catch (error) {
    console.error("[ButtonSelectCategory] Error fetching categories:", error);
    categoriesData.value = [];
  }
});

const categories = computed(() => categoriesData.value);
</script>

<template>
  <!-- <div>
      <CarouselCategories :categories="categories" />
    </div> -->
</template>
