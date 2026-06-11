// app/app.config.ts
export default defineAppConfig({
  site: {
    name: "YardsaleThailand",
    description:
      "ตลาดซื้อขายของมือสองออนไลน์ในไทย — เฟอร์นิเจอร์ เครื่องใช้ไฟฟ้า เสื้อผ้า สินค้ามือสองราคาดี ซื้อขายง่าย จัดส่งทั่วไทย | Thailand second-hand marketplace",
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
