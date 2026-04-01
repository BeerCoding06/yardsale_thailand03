<!--app/components/AppFooter.vue-->
<script setup>
const config = useRuntimeConfig();
const colorMode = useColorMode();
const { locale, locales, setLocale } = useI18n();

const isOpen = ref(false);
const dropdownRef = ref();

const toggleDark = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
};

const colorModeIcon = computed(() => (colorMode.preference === 'dark' ? 'i-iconamoon-mode-dark-fill' : 'i-iconamoon-mode-light-fill'));

onClickOutside(dropdownRef, () => (isOpen.value = false));

const currentLocale = computed(() => locales.value.find(l => l.code === locale.value));

const chooseLocale = code => {
  setLocale(code);
  isOpen.value = false;
};
</script>

<template>
  <footer class="my-5 flex items-center justify-between gap-3 px-5 text-[13px] font-semibold text-secondary-text dark:text-secondary-text-d">
    <div class="truncate">
      <a class="transition-all hover:text-black hover:dark:text-neutral-100" href="https://github.com/zackha/yardsale_thailand" target="_blank">
        Yardsale Thailand v{{ config.public.version }}
      </a>
      —
      {{ $t('footer.developed_by_author') }}
    </div>

    <div class="flex flex-none items-center gap-3">
      <!-- Language -->
      <div v-if="locales?.length > 1" class="relative" ref="dropdownRef">
        <UTooltip :text="$t('footer.change_language')" :open-delay="800">
          <button
            type="button"
            @click="isOpen = !isOpen"
            :aria-expanded="isOpen"
            aria-haspopup="listbox"
            class="flex h-8 items-center gap-1.5 rounded-lg p-2 transition-all text-neutral-800 dark:text-neutral-100 bg-neutral-200/70 hover:bg-neutral-300/80 active:scale-95 dark:bg-neutral-700/70 hover:dark:bg-neutral-600/80">
            {{ currentLocale.name }}
          </button>
        </UTooltip>

        <Transition name="dropdown">
          <div
            v-if="isOpen"
            class="absolute bottom-full right-0 z-10 mb-3 rounded-2xl bg-white text-base font-semibold shadow-[0_0_8px_rgba(0,0,0,.1)] dark:bg-[#262626]"
            role="listbox">
            <ul class="m-2 text-sm w-44">
              <li
                v-for="item in locales"
                :key="item.code || item.name"
                @click="chooseLocale(item.code)"
                class="cursor-pointer rounded-[10px] px-3 py-2 transition-all duration-300 hover:bg-[#e9e9e9] text-black hover:dark:bg-[#3c3c3c] dark:text-white"
                role="option"
                :aria-selected="locale === item.code"
                tabindex="0"
                @keydown.enter.prevent="chooseLocale(item.code)">
                <div class="flex items-center justify-between">
                  <span class="mr-1 truncate">{{ item.name }}</span>
                  <UIcon v-if="locale === item.code" name="i-iconamoon-check-circle-1-fill" size="20" />
                </div>
              </li>
            </ul>
          </div>
        </Transition>
      </div>

      <!-- Theme -->
      <UTooltip :text="$t('theme.toggle')" :open-delay="800">
        <button
          type="button"
          @click="toggleDark"
          class="flex h-8 items-center gap-1.5 rounded-lg p-2 transition-all text-neutral-800 dark:text-neutral-100 bg-neutral-200/70 hover:bg-neutral-300/80 active:scale-95 dark:bg-neutral-700/70 hover:dark:bg-neutral-600/80">
          <UIcon :name="colorModeIcon" size="16" />
          <span class="capitalize leading-4">
            {{ $t('theme.' + colorMode.preference) }}
          </span>
        </button>
      </UTooltip>
    </div>
  </footer>
</template>
