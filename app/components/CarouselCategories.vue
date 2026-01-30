<!--app/components/CarouselCategories.vue-->
<script setup>
import { ref, watch, onMounted } from "vue";
const router = useRouter();
const route = useRoute();
const localePath = useLocalePath();

const props = defineProps({
  categories: {
    type: Array,
    default: () => [],
  },
});

// Debug: Watch categories prop changes
watch(() => props.categories, (newCategories) => {
  console.log('[CarouselCategories] Categories prop changed:', newCategories?.length || 0);
  console.log('[CarouselCategories] Categories data:', newCategories);
}, { deep: true, immediate: true });

onMounted(() => {
  console.log('[CarouselCategories] Component mounted');
  console.log('[CarouselCategories] Categories prop:', props.categories);
  console.log('[CarouselCategories] Categories length:', props.categories?.length || 0);
  console.log('[CarouselCategories] Is array?', Array.isArray(props.categories));
});

const cardsSlider = ref(null);
const showPrev = ref(false);
const showNext = ref(true);
const isDragging = ref(false);
const dragThreshold = 10;
let startX, scrollLeft;

const colors = [
  "bg-[#dad5ff]",
  "bg-[#ffe2eb]",
  "bg-[#ffe4c2]",
  "bg-[#fffd92]",
  "bg-[#cfffcb]",
  "bg-[#dbfff6]",
  "bg-[#d7edff]",
];

const isCollapsed = ref(true); // เริ่มต้นเป็น true เพื่อแสดง sidebar
const setCategory = (category) => {
  if (!isDragging.value && (route.query.category || "") !== category) {
    router.push({
      path: "/", // ← ย้ายไปหน้า index
      query: category ? { category } : {}, // ← ใส่ค่าที่เลือก
    });
    isCollapsed.value = false; // ปิด sidebar
  }
};

// New function for all categories category
const goToAllCategories = () => {
  window.location.href = "http://localhost:3000/categories";
};

const expandedCategory = ref(null); // เก็บ state toggle ของแต่ละ parent

function toggleCategory(id) {
  // ถ้าคลิก parent ที่เปิดอยู่แล้ว → ปิด
  if (expandedCategory.value === id) {
    expandedCategory.value = null;
  } else {
    // เปิด parent ใหม่ → ปิด parent อื่น ๆ อัตโนมัติ
    expandedCategory.value = id;
  }
}

function isExpanded(id) {
  return expandedCategory.value === id;
}

const getCategoryClass = (index) => {
  return `${colors[index % colors.length]} hover:brightness-90`;
};

const initializeDrag = (e) => {
  isDragging.value = false;
  startX = e.pageX - cardsSlider.value.getBoundingClientRect().left;
  scrollLeft = cardsSlider.value.scrollLeft;
  document.addEventListener("mousemove", handleDragging);
  document.addEventListener("mouseup", endDrag);
};

const handleDragging = (e) => {
  const xPos = e.pageX - cardsSlider.value.getBoundingClientRect().left;
  const walk = (xPos - startX) * 1.5;
  cardsSlider.value.scrollLeft = scrollLeft - walk;
  isDragging.value = Math.abs(walk) > dragThreshold;
};

const endDrag = () => {
  document.removeEventListener("mousemove", handleDragging);
  document.removeEventListener("mouseup", endDrag);
};

const updateButtonVisibility = () => {
  const { scrollLeft, scrollWidth, clientWidth } = cardsSlider.value;
  showPrev.value = scrollLeft > 16;
  showNext.value = scrollLeft < scrollWidth - clientWidth - 16;
};

onMounted(() => {
  cardsSlider.value.addEventListener("mousedown", initializeDrag);
  updateButtonVisibility();
});

onBeforeUnmount(() => {
  document.removeEventListener("mousemove", handleDragging);
  document.removeEventListener("mouseup", endDrag);
});
</script>

<template>
  <div
    class="slider-container !fixed z-[9] flex-col pl-[50px] right-[0px] !top-[80px] h-full !items-start transition-all duration-300 ease-in-out"
    :class="
      isCollapsed
        ? 'translate-x-0'
        : 'translate-x-[89%] md:translate-x-[93%] lg:translate-x-[400px]'
    "
  >
    <div class="bg-[#fbfbfb] w-screen px-[30px] py-[20px] h-full lg:w-[400px]">
      <div class="w-full flex justify-between relative">
        <div class="ml-[-70px] absolute">
          <button
            @click="isCollapsed = true"
            class="mb-2 p-2 flex bg-black/5 hover:bg-black/10 dark:bg-white/15 hover:dark:bg-white/20 transition active:scale-95"
          >
            <UIcon name="i-heroicons-bars-3" size="24" />
          </button>
          <NuxtLink
            aria-label="Favorites"
            :to="localePath('/favorites')"
            class="mb-2 p-2 flex items-center justify-center bg-black/5 hover:bg-black/10 dark:bg-white/15 hover:dark:bg-white/20 transition active:scale-95"
          >
            <UIcon
              class="text-[#5f5f5f] dark:text-[#b7b7b7]"
              name="i-iconamoon-heart-fill"
              size="24"
            />
          </NuxtLink>
          <NuxtLink
            aria-label="Categories"
            exactActiveClass="!bg-black/10 dark:!bg-white/30"
            class="mb-2 p-2 flex items-center justify-center bg-black/5 hover:bg-black/10 dark:bg-white/15 hover:dark:bg-white/20 transition active:scale-95"
            :to="localePath('/categories')"
          >
            <UIcon
              class="text-[#5f5f5f] dark:text-[#b7b7b7]"
              name="i-iconamoon-category-fill"
              size="26"
            />
          </NuxtLink>
        </div>

        <button
          @click="isCollapsed = false"
          class="p-2 flex ml-auto h-fit bg-black/5 hover:bg-black/10 dark:bg-white/15 hover:dark:bg-white/20 transition active:scale-95"
        >
          <UIcon name="i-iconamoon-close-bold" size="24" />
        </button>
      </div>
      <div v-if="showPrev" class="slider-btn prev-btn"></div>
      <div class="slider-wrapper mt-[40px]">
        <div
          ref="cardsSlider"
          class="cards-slider flex-col !pr-0"
          @scroll="updateButtonVisibility"
        >
          <!-- Debug info -->
          <div
            v-if="!props.categories || props.categories.length === 0"
            class="p-4 text-sm text-gray-500 dark:text-gray-400"
          >
            <p>ไม่พบข้อมูลหมวดหมู่</p>
            <p class="text-xs mt-1">
              Categories: {{ props.categories?.length || 0 }}
            </p>
            <p class="text-xs mt-1">ตรวจสอบ console log สำหรับรายละเอียด</p>
          </div>

          <div
            @click="goToAllCategories"
            :class="[
              'card h-[50px] transition',
              !route.query.category
                ? 'selected'
                : 'bg-[#efefef] hover:bg-[#e2e2e2] dark:bg-[#262626] hover:dark:bg-[#333] text-black dark:text-white',
            ]"
          >
            <div class="px-3.5">{{ $t("filter.all_categories") }}</div>
          </div>
          <div
            v-for="(category, i) in props.categories"
            :key="category.id || category.name || i"
            class="mb-2"
          >
            <!-- Parent Category Container -->
            <div
              :class="[
                'transition-all overflow-hidden',
                isExpanded(category.id) && category.children?.nodes?.length
                  ? 'bg-white/50 dark:bg-black/20 rounded-2xl'
                  : '',
              ]"
            >
              <!-- Parent Category Button -->
              <div
                @click="toggleCategory(category.id)"
                :class="[
                  'card h-[50px] text-black transition cat-button-bezel flex items-center justify-between',
                  route.query.category === category.name
                    ? 'selected'
                    : getCategoryClass(i),
                ]"
              >
                <div class="flex items-center gap-2">
                  <NuxtImg
                    :alt="category.name"
                    loading="lazy"
                    :src="category.image?.sourceUrl"
                    class="w-[38px] h-[38px] rounded-full object-cover border border-transparent dark:bg-black/15 bg-white/30"
                  />
                  <div class="px-3.5">{{ category.name }}</div>
                </div>
                <span
                  v-if="category.children?.nodes?.length"
                  class="cursor-pointer px-[20px]"
                >
                  {{ isExpanded(category.id) ? "-" : "+" }}
                </span>
              </div>

              <!-- Child categories - แสดงภายใน main category -->
              <div
                v-if="
                  category.children?.nodes?.length && isExpanded(category.id)
                "
                class="px-3 pb-2 pt-1 flex gap-2 flex-wrap"
              >
                <div
                  v-for="child in category.children.nodes"
                  :key="child.name"
                  @click.stop="setCategory(child.name)"
                  :class="[
                    'card h-[40px] text-black transition cat-button-bezel flex items-center gap-2',
                    route.query.category === child.name
                      ? 'selected'
                      : 'bg-gray-100 dark:bg-gray-800',
                  ]"
                >
                  <NuxtImg
                    :alt="child.name"
                    loading="lazy"
                    :src="child.image?.sourceUrl"
                    class="w-[30px] h-[30px] rounded-full object-cover border border-transparent"
                  />
                  <div class="px-2">{{ child.name }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="postcss">
.cat-button-bezel {
  box-shadow: inset 0 -1px 1px 0 rgba(0, 0, 0, 0.05),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.15);
}
img {
  @apply pointer-events-none;
}

.selected {
  @apply bg-[#509e9e] lg:hover:bg-[#509e9e] text-white dark:bg-alizarin-crimson-700 lg:hover:dark:bg-alizarin-crimson-800;
}

.slider-container {
  @apply flex relative overflow-hidden items-center;
}

.slider-wrapper {
  @apply relative w-full overflow-hidden;
}

.cards-slider {
  @apply flex cursor-grab w-full overflow-auto gap-2 lg:gap-4 pr-3 lg:pr-4;
}

.cards-slider:active {
  cursor: grabbing;
}

.card {
  @apply cursor-pointer min-w-max select-none box-border flex items-center rounded-full p-1.5 transition-all;
  &:active {
    @apply cursor-grab scale-95;
  }
}

.slider-btn {
  @apply h-full w-14 cursor-pointer absolute top-0 z-10 flex items-center justify-center select-none;
}

.prev-btn {
  @apply left-0 bg-gradient-to-r from-white dark:from-black;
}

.next-btn {
  right: 0;
  background: #000;
}

.next-btn::before {
  position: absolute;
  content: "";
  right: 56px;
  width: 56px;
  height: 100%;
  background: linear-gradient(to left, rgb(0, 0, 0), transparent);
}

.slider-wrapper::before,
.slider-wrapper::after {
  content: "";
  pointer-events: none;
}
</style>
