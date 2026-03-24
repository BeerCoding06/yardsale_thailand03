/**
 * รวม URL เรียก Yardsale API (Express) เมื่อตั้ง `NUXT_PUBLIC_CMS_API_BASE`
 * - เต็ม URL: http://localhost:4000/api (ข้าม origin — อาจโดน CORS / Failed to fetch)
 * - Dev แนะนำ: /yardsale-api — ผ่าน Vite proxy → 127.0.0.1:4000/api (same-origin กับ Nuxt)
 * path ที่ส่งเข้าไม่ต้องมี /api ซ้ำ
 */
import { useRuntimeConfig } from "nuxt/app";
import {
  cmsEndpointFromPublic,
  hasRemoteCmsApi,
} from "~/utils/cmsApiEndpoint";

export function useCmsApi() {
  const config = useRuntimeConfig();
  const pub = config.public as { cmsApiBase?: string; baseUrl?: string };

  function endpoint(path: string): string {
    return cmsEndpointFromPublic(pub, path, import.meta.client);
  }

  return { endpoint, hasRemoteApi: hasRemoteCmsApi(pub) };
}
