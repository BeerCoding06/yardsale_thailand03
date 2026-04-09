// app/app.config.ts
export default defineAppConfig({
  site: {
    name: "YardsaleThailand",
    description: "YardsaleThailand",
  },
  ui: {
    primary: "red",
    gray: "neutral",
    formGroup: {
      label: {
        required:
          "after:content-['*'] after:ms-0.5 after:font-semibold after:text-red-600 dark:after:text-red-400",
      },
    },
  },
});
