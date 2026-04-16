export function useAdminCategoryUpload() {
  const { adminFetch } = useAdminFetch();
  const isUploading = ref(false);

  async function uploadPickedFile(file: File): Promise<string | null> {
    isUploading.value = true;
    try {
      const fd = new FormData();
      fd.append("image", file);
      const data = (await adminFetch<unknown>("upload-image", {
        method: "POST",
        body: fd,
      })) as Record<string, unknown> | null;
      const url =
        (data as { image?: { sourceUrl?: string } })?.image?.sourceUrl;
      return url ? String(url) : null;
    } finally {
      isUploading.value = false;
    }
  }

  return { isUploading, uploadPickedFile };
}
