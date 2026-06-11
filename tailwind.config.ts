import type { Config } from 'tailwindcss';

export default <Partial<Config>>{
  content: [
    './app/**/*.{js,ts,vue}',
    './components/**/*.{js,ts,vue}',
    './pages/**/*.{js,ts,vue}',
    './layouts/**/*.{js,ts,vue}',
  ],
  theme: {
    extend: {
      screens: {
        xs: '320px',
        '3xl': '1920px',
      },
      colors: {
        /** WCAG AA on #fff / #fafafa (≥4.5:1) */
        'secondary-text': '#525252',
        /** WCAG AA on dark surfaces */
        'secondary-text-d': '#d4d4d4',
        'muted-fg': '#525252',
        'muted-fg-dark': '#d4d4d4',
        'alizarin-crimson': {
          '50': '#fff0f2',
          '100': '#ffdde2',
          '200': '#ffc1ca',
          '300': '#ff95a5',
          '400': '#ff5972',
          '500': '#ff2646',
          '600': '#fc062a',
          '700': '#e60022',
          '800': '#af051e',
          '900': '#900c20',
          '950': '#50000c',
        },
      },
    },
  },
  plugins: [],
};
