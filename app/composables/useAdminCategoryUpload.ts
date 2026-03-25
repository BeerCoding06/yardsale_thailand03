export function unwrapAdminData(res: unknown): any {
  const r = res as { success?: boolean; data?: unknown } | null;
  if (r && typeof r === "object" && r.success === true && r.data != null) {
    return r.data;
  }
  return res;
}

export function useAdminCategoryUpload() {
  const { authHeaders, endpoint } = useAdminFetch();
  const isUploading = ref(false);

  async function uploadPickedFile(file: File): Promise<string | null> {
    isUploading.value = true;
    try {
      const fd = new FormData();
      fd.append("image", file);
      const raw = await $fetch(endpoint("upload-image"), {
        method: "POST",
        body: fd,
        headers: authHeaders(),
      });
      const data = unwrapAdminData(raw);
      const url =
        (data as any)?.image?.sourceUrl ||
        (raw as any)?.data?.image?.sourceUrl ||
        (raw as any)?.image?.sourceUrl;
      return url ? String(url) : null;
    } finally {
      isUploading.value = false;
    }
  }

  return { isUploading, uploadPickedFile };
}
