<!--app/components/user/FormCreateProducts.vue-->
<script setup>
// Authentication
const { user, isAuthenticated } = useAuth();
const { t } = useI18n();

// Form data
const form = ref({
  type: "simple",
  name: "",
  regular_price: "",
  sale_price: "",
  description: "",
  short_description: "",
  manage_stock: true,
  stock_quantity: 1,
  categories: [],
  tags: [],
  brand: [],
  images: [],
});

// UI state
const isSubmitting = ref(false);
const message = ref(null);
const isDragging = ref(false);

// Validation errors
const errors = ref({
  name: "",
  regular_price: "",
  category: "",
  stock_quantity: "",
  sale_price: "",
  description: "",
  images: "",
});

// Categories from WordPress
const categories = ref([]);
const isLoadingCategories = ref(false);
const selectedCategoryId = ref(null);

// CarouselCategories ถูกย้ายไปที่ app.vue แล้ว เพื่อแสดงในทุกหน้า

// Image handling
const imageInput = ref(null);
const uploadedImages = ref([]);

// Select2 refs
const categorySelect = ref(null);
const tagsSelect = ref(null);
const brandSelect = ref(null);

// Editor refs
const descriptionEditor = ref(null);
const descriptionEditorInstance = ref(null);
const shortDescriptionEditor = ref(null);
const shortDescriptionEditorInstance = ref(null);

// Tags and Brands from WordPress
const tags = ref([]);
const brands = ref([]);
const isLoadingTags = ref(false);
const isLoadingBrands = ref(false);
const selectedTags = ref([]);
const selectedBrands = ref([]);

// Load Select2 and Quill from CDN
// Load jQuery first, then Select2 and Quill
onMounted(() => {
  if (import.meta.client) {
    // Load jQuery first
    const jqueryScript = document.createElement('script');
    jqueryScript.src = 'https://code.jquery.com/jquery-3.7.1.min.js';
    jqueryScript.integrity = 'sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=';
    jqueryScript.crossOrigin = 'anonymous';
    jqueryScript.onload = () => {
      // Load Select2 after jQuery
      const select2Script = document.createElement('script');
      select2Script.src = 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js';
      document.head.appendChild(select2Script);
      
      // Load Quill
      const quillScript = document.createElement('script');
      quillScript.src = 'https://cdn.quilljs.com/1.3.6/quill.js';
      document.head.appendChild(quillScript);
    };
    document.head.appendChild(jqueryScript);
  }
});

useHead({
  link: [
    {
      rel: "stylesheet",
      href: "https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css",
    },
    {
      rel: "stylesheet",
      href: "https://cdn.quilljs.com/1.3.6/quill.snow.css",
    },
  ],
});

// Initialize Select2
const initSelect2 = () => {
  if (categorySelect.value && window.jQuery && window.jQuery.fn.select2) {
    const $ = window.jQuery;

    // Destroy existing instance if any
    if ($(categorySelect.value).hasClass("select2-hidden-accessible")) {
      $(categorySelect.value).select2("destroy");
    }

    $(categorySelect.value).select2({
      placeholder: t('create_product.select_category'),
      allowClear: false,
      width: "100%",
      language: {
        noResults: function () {
          return t('create_product.no_results');
        },
        searching: function () {
          return t('create_product.searching');
        },
      },
    });

    // Apply error class if needed
    const $select2Container = $(categorySelect.value).next(
      ".select2-container"
    );
    if ($select2Container.length && errors.value.category) {
      $select2Container.addClass("select2-container--error");
    } else if ($select2Container.length) {
      $select2Container.removeClass("select2-container--error");
    }

    // Handle Select2 change event
    $(categorySelect.value).on("change", function () {
      const selectedValue = $(this).val();
      selectedCategoryId.value = selectedValue || null;
    });
  }
};

// Wait for jQuery and Select2 to load
const waitForSelect2 = () => {
  return new Promise((resolve) => {
    if (import.meta.client && window.jQuery && window.jQuery.fn.select2) {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (import.meta.client && window.jQuery && window.jQuery.fn.select2) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    }
  });
};

// Wait for Quill to load
const waitForQuill = () => {
  return new Promise((resolve) => {
    if (import.meta.client && window.Quill) {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (import.meta.client && window.Quill) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    }
  });
};

// Initialize Tags Select2
const initTagsSelect2 = () => {
  if (
    import.meta.client &&
    tagsSelect.value &&
    window.jQuery &&
    window.jQuery.fn.select2
  ) {
    const $ = window.jQuery;

    // Destroy existing instance if any
    if ($(tagsSelect.value).hasClass("select2-hidden-accessible")) {
      $(tagsSelect.value).select2("destroy");
    }

    $(tagsSelect.value).select2({
      placeholder: t('create_product.select_tags'),
      allowClear: false,
      multiple: true,
      width: "100%",
      language: {
        noResults: function () {
          return t('create_product.no_results');
        },
        searching: function () {
          return t('create_product.searching');
        },
      },
    });

    // Handle Select2 change event
    $(tagsSelect.value).on("change", function () {
      const selectedValues = $(this).val() || [];
      selectedTags.value = selectedValues.map((v) => Number(v));
      form.value.tags = selectedValues.map((v) => ({ id: Number(v) }));
    });
  }
};

// Initialize Brand Select2
const initBrandSelect2 = () => {
  if (
    import.meta.client &&
    brandSelect.value &&
    window.jQuery &&
    window.jQuery.fn.select2
  ) {
    const $ = window.jQuery;

    // Destroy existing instance if any
    if ($(brandSelect.value).hasClass("select2-hidden-accessible")) {
      $(brandSelect.value).select2("destroy");
    }

    $(brandSelect.value).select2({
      placeholder: t('create_product.select_brand'),
      allowClear: false,
      multiple: true,
      width: "100%",
      language: {
        noResults: function () {
          return t('create_product.no_results');
        },
        searching: function () {
          return t('create_product.searching');
        },
      },
    });

    // Handle Select2 change event
    $(brandSelect.value).on("change", function () {
      const selectedValues = $(this).val() || [];
      selectedBrands.value = selectedValues.map((v) => Number(v));
      form.value.brand = selectedValues.map((v) => String(v));
    });
  }
};

// Fetch categories, tags, and brands from WordPress
onMounted(async () => {
  isLoadingCategories.value = true;
  isLoadingTags.value = true;
  isLoadingBrands.value = true;

  try {
    // Fetch categories for form select
    console.log("[Form] Fetching categories from /api/wp-categories...");
    try {
      const categoriesData = await $fetch("/api/wp-categories");
      console.log("[Form] Received categories:", categoriesData);
      categories.value = Array.isArray(categoriesData) ? categoriesData : [];
      console.log("[Form] Loaded categories:", categories.value.length);
    } catch (error) {
      console.error("[Form] Error loading categories:", error);
      categories.value = [];
      message.value = {
        type: "error",
        text: `${t('create_product.cannot_load_categories')}: ${
          error?.message || t('create_product.unknown_error')
        }`,
      };
    }

    // CarouselCategories ถูกย้ายไปที่ app.vue แล้ว เพื่อแสดงในทุกหน้า

    // Fetch tags
    console.log("[Form] Fetching tags from /api/wp-tags...");
    try {
      const tagsData = await $fetch("/api/wp-tags").catch((err) => {
        console.warn("[Form] Tags API error:", err);
        return [];
      });
      tags.value = Array.isArray(tagsData) && tagsData ? tagsData : [];
      console.log("[Form] Loaded tags:", tags.value.length);
    } catch (error) {
      console.warn("[Form] Error loading tags:", error);
      tags.value = [];
    }

    // Fetch brands
    console.log("[Form] Fetching brands from /api/wp-brands...");
    try {
      const brandsData = await $fetch("/api/wp-brands").catch((err) => {
        console.warn("[Form] Brands API error:", err);
        return [];
      });
      brands.value = Array.isArray(brandsData) && brandsData ? brandsData : [];
      console.log("[Form] Loaded brands:", brands.value.length);
    } catch (error) {
      console.warn("[Form] Error loading brands:", error);
      brands.value = [];
    }

    if (categories.value.length === 0) {
      message.value = {
        type: "error",
        text: t('create_product.no_categories_found'),
      };
    }

    // Wait for Select2 to load, then initialize
    await waitForSelect2();
    await nextTick();
    initSelect2();
    initTagsSelect2();
    initBrandSelect2();
    
    // Wait for Quill to load, then initialize editors
    await waitForQuill();
    await nextTick();
    initQuillEditor();
    initShortDescriptionEditor();
  } catch (error) {
    console.error("[Form] Error loading data:", error);
    message.value = {
      type: "error",
      text: `${t('create_product.cannot_load_data')}: ${error?.message || t('create_product.unknown_error')}`,
    };
  } finally {
    isLoadingCategories.value = false;
    isLoadingTags.value = false;
    isLoadingBrands.value = false;
  }
});

// Watch categories and reinitialize Select2 when they change
watch(
  () => categories.value,
  () => {
    if (categories.value.length > 0) {
      nextTick(() => {
        waitForSelect2().then(() => {
          initSelect2();
        });
      });
    }
  },
  { deep: true }
);

// Watch selectedCategoryId and update Select2 value
watch(selectedCategoryId, (newId) => {
  if (categorySelect.value && window.jQuery && window.jQuery.fn.select2) {
    const $ = window.jQuery;
    if ($(categorySelect.value).hasClass("select2-hidden-accessible")) {
      $(categorySelect.value)
        .val(newId || "")
        .trigger("change");
    }
  }

  if (newId) {
    form.value.categories = [{ id: Number(newId) }];
    errors.value.category = ""; // Clear error when category is selected
  } else {
    form.value.categories = [];
  }
});

// Watch errors.category to update Select2 error class
watch(
  () => errors.value.category,
  (error) => {
    if (categorySelect.value && window.jQuery && window.jQuery.fn.select2) {
      const $ = window.jQuery;
      const $select2Container = $(categorySelect.value).next(
        ".select2-container"
      );
      if ($select2Container.length) {
        if (error) {
          $select2Container.addClass("select2-container--error");
        } else {
          $select2Container.removeClass("select2-container--error");
        }
      }
    }
  }
);

// Initialize Quill Editor for Description
const initQuillEditor = () => {
  if (import.meta.client && descriptionEditor.value && window.Quill) {
    // Destroy existing instance if any
    if (descriptionEditorInstance.value) {
      descriptionEditorInstance.value = null;
    }

    // Create new Quill instance
    descriptionEditorInstance.value = new window.Quill(
      descriptionEditor.value,
      {
        theme: "snow",
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ align: [] }],
            ["link"],
            ["clean"],
          ],
        },
        placeholder: t('create_product.description_placeholder'),
        formats: ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'align', 'link'],
      }
    );
    
    // Configure Quill to prevent empty <p> tags and <br> tags
    const quill = descriptionEditorInstance.value;
    
    // Function to remove empty paragraphs from DOM immediately
    const removeEmptyParagraphs = () => {
      const root = quill.root;
      const emptyPs = root.querySelectorAll('p');
      
      emptyPs.forEach((p) => {
        const text = p.textContent || p.innerText || '';
        const html = p.innerHTML || '';
        
        // Remove if paragraph is empty or only contains <br> or whitespace
        if (!text.trim() || html.match(/^<br\s*\/?>$/i) || html.trim() === '') {
          p.remove();
        }
      });
    };
    
    // Clean HTML function for form value
    const cleanHTML = (html) => {
      if (!html) return '';
      
      // Remove empty <p></p> tags
      let cleaned = html.replace(/<p><\/p>/g, '');
      
      // Remove <p><br></p> tags (empty paragraphs with line break)
      cleaned = cleaned.replace(/<p><br\s*\/?><\/p>/gi, '');
      
      // Remove <p> with only whitespace
      cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
      
      // Remove multiple consecutive <br> tags (keep only one)
      cleaned = cleaned.replace(/(<br\s*\/?>){2,}/gi, '<br>');
      
      // Remove <br> at the end of paragraphs
      cleaned = cleaned.replace(/<br\s*\/?>(?=\s*<\/p>)/gi, '');
      
      // If result is empty or only whitespace, return empty string
      const textOnly = cleaned.replace(/<[^>]+>/g, '').trim();
      if (!textOnly) {
        return '';
      }
      
      return cleaned;
    };
    
    // Update form value with cleaned HTML
    const updateFormValue = () => {
      // Remove empty paragraphs from DOM first
      removeEmptyParagraphs();
      
      const html = quill.root.innerHTML;
      const cleaned = cleanHTML(html);
      
      // Only update if cleaned HTML is different
      if (cleaned !== form.value.description) {
        form.value.description = cleaned;
        if (cleaned && cleaned.trim()) {
          errors.value.description = "";
        }
      }
    };
    
    // Use text-change event to remove empty paragraphs immediately
    quill.on('text-change', function() {
      // Remove empty paragraphs immediately
      removeEmptyParagraphs();
      
      // Update form value with debounce
      clearTimeout(quill._updateTimeout);
      quill._updateTimeout = setTimeout(() => {
        updateFormValue();
      }, 100);
    });
  }
};

// Initialize Quill Editor for Short Description
const initShortDescriptionEditor = () => {
  if (import.meta.client && shortDescriptionEditor.value && window.Quill) {
    // Destroy existing instance if any
    if (shortDescriptionEditorInstance.value) {
      shortDescriptionEditorInstance.value = null;
    }

    // Create new Quill instance (simpler toolbar for short description)
    shortDescriptionEditorInstance.value = new window.Quill(
      shortDescriptionEditor.value,
      {
        theme: "snow",
        modules: {
          toolbar: [
            ["bold", "italic", "underline"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link"],
            ["clean"],
          ],
        },
        placeholder: t('create_product.short_description_placeholder'),
        formats: ['bold', 'italic', 'underline', 'list', 'bullet', 'link'],
      }
    );
    
    // Configure Quill to prevent empty <p> tags and <br> tags
    const quillShort = shortDescriptionEditorInstance.value;
    
    // Function to remove empty paragraphs from DOM immediately
    const removeEmptyParagraphsShort = () => {
      const root = quillShort.root;
      const emptyPs = root.querySelectorAll('p');
      
      emptyPs.forEach((p) => {
        const text = p.textContent || p.innerText || '';
        const html = p.innerHTML || '';
        
        // Remove if paragraph is empty or only contains <br> or whitespace
        if (!text.trim() || html.match(/^<br\s*\/?>$/i) || html.trim() === '') {
          p.remove();
        }
      });
    };
    
    // Clean HTML function for form value
    const cleanHTMLShort = (html) => {
      if (!html) return '';
      
      // Remove empty <p></p> tags
      let cleaned = html.replace(/<p><\/p>/g, '');
      
      // Remove <p><br></p> tags (empty paragraphs with line break)
      cleaned = cleaned.replace(/<p><br\s*\/?><\/p>/gi, '');
      
      // Remove <p> with only whitespace
      cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
      
      // Remove multiple consecutive <br> tags (keep only one)
      cleaned = cleaned.replace(/(<br\s*\/?>){2,}/gi, '<br>');
      
      // Remove <br> at the end of paragraphs
      cleaned = cleaned.replace(/<br\s*\/?>(?=\s*<\/p>)/gi, '');
      
      // If result is empty or only whitespace, return empty string
      const textOnly = cleaned.replace(/<[^>]+>/g, '').trim();
      if (!textOnly) {
        return '';
      }
      
      return cleaned;
    };
    
    // Update form value with cleaned HTML
    const updateFormValueShort = () => {
      // Remove empty paragraphs from DOM first
      removeEmptyParagraphsShort();
      
      const html = quillShort.root.innerHTML;
      const cleaned = cleanHTMLShort(html);
      
      // Only update if cleaned HTML is different
      if (cleaned !== form.value.short_description) {
        form.value.short_description = cleaned;
      }
    };
    
    // Use text-change event to remove empty paragraphs immediately
    quillShort.on('text-change', function() {
      // Remove empty paragraphs immediately
      removeEmptyParagraphsShort();
      
      // Update form value with debounce
      clearTimeout(quillShort._updateTimeout);
      quillShort._updateTimeout = setTimeout(() => {
        updateFormValueShort();
      }, 100);
    });
  }
};

// Cleanup Select2 and Quill on unmount
onBeforeUnmount(() => {
  if (window.jQuery && window.jQuery.fn.select2) {
    const $ = window.jQuery;

    const selectRefs = [categorySelect, tagsSelect, brandSelect];

    selectRefs.forEach((selectRef) => {
      if (
        selectRef.value &&
        $(selectRef.value).hasClass("select2-hidden-accessible")
      ) {
        $(selectRef.value).select2("destroy");
      }
    });
  }
  
  // Cleanup Quill editors
  if (descriptionEditorInstance.value) {
    descriptionEditorInstance.value = null;
  }
  if (shortDescriptionEditorInstance.value) {
    shortDescriptionEditorInstance.value = null;
  }
});

// Watch form fields for real-time validation
watch(
  () => form.value.name,
  (newVal) => {
    if (newVal && newVal.trim()) {
      errors.value.name = "";
    }
  }
);

watch(
  () => form.value.regular_price,
  (newVal) => {
    if (newVal && Number(newVal) > 0) {
      errors.value.regular_price = "";
      // Also validate sale_price when regular_price changes
      if (
        form.value.sale_price &&
        Number(form.value.sale_price) >= Number(newVal)
      ) {
        errors.value.sale_price = t('create_product.sale_price_must_be_lower');
      } else {
        errors.value.sale_price = "";
      }
    }
  }
);

watch(
  () => form.value.sale_price,
  (newVal) => {
    if (newVal && form.value.regular_price) {
      if (Number(newVal) >= Number(form.value.regular_price)) {
        errors.value.sale_price = t('create_product.sale_price_must_be_lower');
      } else {
        errors.value.sale_price = "";
      }
    } else if (!newVal) {
      errors.value.sale_price = "";
    }
  }
);

watch(
  () => form.value.stock_quantity,
  (newVal) => {
    if (form.value.manage_stock) {
      if (newVal && Number(newVal) > 0) {
        errors.value.stock_quantity = "";
      }
    } else {
      errors.value.stock_quantity = "";
    }
  }
);

watch(
  () => form.value.manage_stock,
  (newVal) => {
    if (!newVal) {
      // Set default to 1 if manage_stock is enabled
      if (form.value.manage_stock) {
        form.value.stock_quantity = 1;
      }
      errors.value.stock_quantity = "";
    } else if (form.value.manage_stock && form.value.stock_quantity <= 0) {
      // Set default to 1 if value is <= 0
      form.value.stock_quantity = 1;
      errors.value.stock_quantity = "";
    }
  }
);

watch(
  () => form.value.description,
  (newVal) => {
    if (newVal && newVal.trim()) {
      errors.value.description = "";
    }
  }
);

watch(
  () => uploadedImages.value,
  (newVal) => {
    if (newVal && newVal.length > 0) {
      errors.value.images = "";
    }
  },
  { deep: true }
);

// Handle file selection
const handleFileSelect = (files) => {
  if (!files || files.length === 0) return;

  Array.from(files).forEach((file) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target && e.target.result;
        uploadedImages.value.push({ src, file });
        form.value.images.push({ src });
      };
      reader.readAsDataURL(file);
    }
  });
};

// Handle drag and drop
const handleDragOver = (e) => {
  e.preventDefault();
  isDragging.value = true;
};

const handleDragLeave = (e) => {
  e.preventDefault();
  isDragging.value = false;
};

const handleDrop = (e) => {
  e.preventDefault();
  isDragging.value = false;
  handleFileSelect((e.dataTransfer && e.dataTransfer.files) || null);
};

// Remove image
const removeImage = (index) => {
  uploadedImages.value.splice(index, 1);
  form.value.images.splice(index, 1);
  // Show error if no images left
  if (uploadedImages.value.length === 0) {
    errors.value.images = t('create_product.please_select_images');
  }
};

// Handle form submission
const handleSubmit = async (e) => {
  if (e) e.preventDefault();
  message.value = null;

  // Validation with error messages
  let hasErrors = false;

  // Validate name
  if (!form.value.name || !form.value.name.trim()) {
    errors.value.name = t('create_product.please_enter_name');
    hasErrors = true;
  }

  // Validate regular_price
  if (!form.value.regular_price || Number(form.value.regular_price) <= 0) {
    errors.value.regular_price = t('create_product.please_enter_regular_price');
    hasErrors = true;
  }

  // Validate category
  if (!selectedCategoryId.value || form.value.categories.length === 0) {
    errors.value.category = t('create_product.please_select_category');
    hasErrors = true;
  }

  // Validate description
  if (!form.value.description || !form.value.description.trim()) {
    errors.value.description = t('create_product.please_enter_description');
    hasErrors = true;
  }

  // Validate images
  if (!uploadedImages.value || uploadedImages.value.length === 0) {
    errors.value.images = t('create_product.please_select_images');
    hasErrors = true;
  }

  // Validate stock quantity (must be greater than 0 if manage_stock is enabled)
  // Set default to 1 if not provided or invalid
  if (form.value.manage_stock) {
    if (
      !form.value.stock_quantity ||
      form.value.stock_quantity === "" ||
      Number(form.value.stock_quantity) <= 0
    ) {
      // Set default value to 1 if not provided or invalid
      form.value.stock_quantity = 1;
    }
  }

  // Validate sale price (must be less than regular price)
  if (form.value.sale_price && form.value.regular_price) {
    if (Number(form.value.sale_price) >= Number(form.value.regular_price)) {
      errors.value.sale_price = "ราคาขายต้องต่ำกว่าราคาปกติ";
      hasErrors = true;
    }
  }

  if (hasErrors) {
    message.value = { type: "error", text: t('auth.check_data') };
    return;
  }

  // Check if user is authenticated
  if (!isAuthenticated.value || !user.value || !user.value.id) {
    message.value = {
      type: "error",
      text: t('my_products.login_required_create'),
    };
    return;
  }

  isSubmitting.value = true;

  try {
    // Prepare payload
    const payload = {
      name: form.value.name,
      type: form.value.type || "simple", // Use simple product type
      regular_price: String(form.value.regular_price),
      sale_price: form.value.sale_price
        ? String(form.value.sale_price)
        : undefined,
      description: form.value.description || undefined,
      short_description: form.value.short_description || undefined,
      manage_stock: form.value.manage_stock,
      stock_quantity: form.value.stock_quantity,
      status: "pending",
      categories: form.value.categories,
      tags: form.value.tags.length > 0 ? form.value.tags : undefined,
      brand: form.value.brand.length > 0 ? form.value.brand : undefined,
      post_author: user.value.id, // Add logged-in user ID as post_author
    };

    // Upload images to WordPress media library first
    console.log("[Form] Original form.value.images:", form.value.images);
    console.log("[Form] uploadedImages:", uploadedImages.value);

    if (uploadedImages.value && uploadedImages.value.length > 0) {
      const uploadedImageUrls = [];

      // Upload each image to WordPress
      for (const img of uploadedImages.value) {
        if (img && img.file) {
          try {
            console.log("[Form] Uploading image:", img.file.name);

            // Create FormData for upload
            const formData = new FormData();
            formData.append("file", img.file);

            // Upload to WordPress media library
            const uploadResult = await $fetch("/api/upload-image", {
              method: "POST",
              body: formData,
            }).catch((uploadError) => {
              console.error("[Form] Failed to upload image:", uploadError);
              throw uploadError; // Re-throw to stop the process
            });

            if (uploadResult && uploadResult.src) {
              uploadedImageUrls.push({ src: uploadResult.src });
              console.log(
                "[Form] Image uploaded successfully:",
                uploadResult.src
              );
            }
          } catch (error) {
            console.error("[Form] Failed to upload image:", error);
            // Show error message to user
            message.value = {
              type: "error",
              text: `${t('create_product.cannot_upload_image')}: ${
                error?.message || t('create_product.unknown_error')
              }`,
            };
            isSubmitting.value = false;
            return; // Stop the submission process
          }
        } else if (img && img.src) {
          // If it's already a URL (not base64), use it directly
          if (img.src.startsWith("http://") || img.src.startsWith("https://")) {
            uploadedImageUrls.push({ src: img.src });
            console.log("[Form] Using existing URL:", img.src);
          }
        }
      }

      if (uploadedImageUrls.length > 0) {
        payload.images = uploadedImageUrls;
        console.log("[Form] Adding images to payload:", payload.images);
      } else {
        console.warn("[Form] No images were uploaded successfully");
      }
    } else if (form.value.images && form.value.images.length > 0) {
      // Fallback: use form.value.images if uploadedImages is empty (already URLs)
      const processedImages = form.value.images
        .map((img) => {
          if (typeof img === "string") {
            if (img.startsWith("http://") || img.startsWith("https://")) {
              return { src: img };
            }
            return null;
          }
          if (img && img.src) {
            if (
              img.src.startsWith("http://") ||
              img.src.startsWith("https://")
            ) {
              return { src: img.src };
            }
            return null;
          }
          return null;
        })
        .filter((img) => img !== null);

      if (processedImages.length > 0) {
        payload.images = processedImages;
        console.log(
          "[Form] Adding images from form.value.images:",
          payload.images
        );
      }
    } else {
      console.log("[Form] No images found in form");
    }

    // Remove undefined fields
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    console.log("[Form] Sending payload:", payload);

    // Send to Nuxt API endpoint (which will call PHP API)
    const response = await $fetch("/api/create-product", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
    });

    console.log("[Form] Response:", response);

    message.value = {
      type: "success",
      text: t('create_product.create_success'),
    };

    // Reset form after 2 seconds
    setTimeout(() => {
      const resetForm = {
        type: "simple",
        name: "",
        regular_price: "",
        sale_price: "",
        description: "",
        short_description: "",
        manage_stock: true,
        stock_quantity: 1,
        categories: [],
        tags: [],
        brand: [],
        images: [],
      };

      form.value = resetForm;
      selectedCategoryId.value = null;
      selectedTags.value = [];
      selectedBrands.value = [];

      // Reset Select2 values
      if (import.meta.client && window.jQuery && window.jQuery.fn.select2) {
        const $ = window.jQuery;
        const selectRefs = [tagsSelect, brandSelect];

        selectRefs.forEach((selectRef) => {
          if (
            selectRef.value &&
            $(selectRef.value).hasClass("select2-hidden-accessible")
          ) {
            $(selectRef.value).val(null).trigger("change");
          }
        });
      }

      // Clear all errors
      errors.value = {
        name: "",
        regular_price: "",
        category: "",
        stock_quantity: "",
        sale_price: "",
      };
      uploadedImages.value = [];
      message.value = null;
    }, 2000);
  } catch (error) {
    console.error("[Form] Error:", error);
    message.value = {
      type: "error",
      text:
        (error.data && error.data.error) ||
        error.message ||
        t('create_product.create_error'),
    };
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div>
    <div class="max-w-4xl mx-auto p-6">
      <h1 class="text-3xl font-bold mb-6 text-black dark:text-white">
        {{ $t('create_product.title') }}
      </h1>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Basic Information -->
        <div
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
        >
          <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
            {{ $t('create_product.basic_info') }}
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >{{ $t('create_product.product_name') }} *</label
              >
              <input
                v-model="form.name"
                type="text"
                required
                :class="[
                  'w-full px-4 py-3 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors',
                  errors.name
                    ? 'border-red-500 dark:border-red-500 focus:border-red-600 dark:focus:border-red-600'
                    : 'border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600',
                ]"
                :placeholder="$t('create_product.product_name_placeholder')"
              />
              <p
                v-if="errors.name"
                class="text-xs text-red-500 dark:text-red-400 mt-1"
              >
                {{ errors.name }}
              </p>
            </div>

            <div>
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >{{ $t('create_product.regular_price') }} *</label
              >
              <input
                v-model.number="form.regular_price"
                type="number"
                step="0.01"
                required
                min="0"
                :class="[
                  'w-full px-4 py-3 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors',
                  errors.regular_price
                    ? 'border-red-500 dark:border-red-500 focus:border-red-600 dark:focus:border-red-600'
                    : 'border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600',
                ]"
                placeholder="0.00"
              />
              <p
                v-if="errors.regular_price"
                class="text-xs text-red-500 dark:text-red-400 mt-1"
              >
                {{ errors.regular_price }}
              </p>
            </div>

            <div>
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >{{ $t('create_product.sale_price') }}</label
              >
              <input
                v-model.number="form.sale_price"
                type="number"
                step="0.01"
                min="0"
                :max="
                  form.regular_price
                    ? Number(form.regular_price) - 0.01
                    : undefined
                "
                :class="[
                  'w-full px-4 py-3 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors',
                  errors.sale_price
                    ? 'border-red-500 dark:border-red-500 focus:border-red-600 dark:focus:border-red-600'
                    : 'border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600',
                ]"
                placeholder="0.00"
              />
              <p
                v-if="errors.sale_price"
                class="text-xs text-red-500 dark:text-red-400 mt-1"
              >
                {{ errors.sale_price }}
              </p>
              <p
                v-else
                class="text-xs text-neutral-500 dark:text-neutral-400 mt-1"
              >
                {{ $t('create_product.sale_price_hint') }}
              </p>
            </div>

            <div class="md:col-span-2">
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >{{ $t('create_product.category') }} *</label
              >
              <select
                ref="categorySelect"
                required
                :disabled="isLoadingCategories"
                :class="[
                  'w-full px-4 py-3 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  errors.category
                    ? 'border-red-500 dark:border-red-500 focus:border-red-600 dark:focus:border-red-600'
                    : 'border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600',
                ]"
              >
                <option value="">
                  {{ isLoadingCategories ? $t('general.loading') : $t('create_product.select_category') }}
                </option>
                <option
                  v-for="category in categories"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.name }}
                </option>
              </select>
              <p
                v-if="errors.category"
                class="text-xs text-red-500 dark:text-red-400 mt-1"
              >
                {{ errors.category }}
              </p>
            </div>

            <!-- Tags -->
            <div class="md:col-span-2">
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >{{ $t('create_product.tags') }}</label
              >
              <select
                ref="tagsSelect"
                multiple
                :disabled="isLoadingTags"
                :class="[
                  'w-full px-4 py-3 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  'border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600',
                ]"
              >
                <option v-for="tag in tags" :key="tag.id" :value="tag.id">
                  {{ tag.name }}
                </option>
              </select>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ $t('create_product.tags_hint') }}
              </p>
            </div>

            <!-- Brand -->
            <div class="md:col-span-2">
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >{{ $t('create_product.brand') }}</label
              >
              <select
                ref="brandSelect"
                multiple
                :disabled="isLoadingBrands"
                :class="[
                  'w-full px-4 py-3 rounded-xl border-2 bg-white/80 dark:bg-black/20 text-black dark:text-white focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  'border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600',
                ]"
              >
                <option
                  v-for="brand in brands"
                  :key="brand.id"
                  :value="brand.id"
                >
                  {{ brand.name }}
                </option>
              </select>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ $t('create_product.brand_hint') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
        >
          <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
            {{ $t('create_product.description') }}
          </h2>

          <div class="space-y-4">
            <div>
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >{{ $t('create_product.short_description') }}</label
              >
              <div
                ref="shortDescriptionEditor"
                class="quill-editor-short bg-white/80 dark:bg-black/20 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 focus-within:border-black dark:focus-within:border-white hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
              ></div>
            </div>

            <div>
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >{{ $t('create_product.description') }}</label
              >
              <div
                ref="descriptionEditor"
                class="quill-editor bg-white/80 dark:bg-black/20 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 focus-within:border-black dark:focus-within:border-white hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
              ></div>
            </div>
          </div>
        </div>

        <!-- Stock Management -->
        <div
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
        >
          <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
            {{ $t('create_product.stock_management') }}
          </h2>

          <div class="space-y-4">
            <label class="flex items-center gap-3 cursor-pointer">
              <input
                v-model="form.manage_stock"
                type="checkbox"
                class="w-5 h-5 rounded border-2 border-black dark:border-white text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
              <span class="text-sm font-medium text-black dark:text-white"
                >{{ $t('create_product.manage_stock') }}</span
              >
            </label>

            <div v-if="form.manage_stock">
              <label
                class="block text-sm font-medium mb-2 text-black dark:text-white"
                >{{ $t('create_product.stock_quantity') }} *</label
              >
              <input
                v-model.number="form.stock_quantity"
                type="number"
                min="1"
                required
                class="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-black/20 text-black dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-black dark:focus:border-white hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
                placeholder="1"
              />
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ $t('create_product.stock_quantity_hint') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Images Upload -->
        <div
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
        >
          <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
            {{ $t('create_product.product_images') }}
          </h2>

          <!-- Drag & Drop Area -->
          <div
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            :class="[
              'border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer',
              isDragging
                ? 'border-black dark:border-white bg-black/5 dark:bg-white/10'
                : 'border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white',
            ]"
            @click="imageInput && imageInput.click()"
          >
            <input
              ref="imageInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="
                (e) => handleFileSelect((e.target && e.target.files) || null)
              "
            />

            <div class="space-y-2">
              <UIcon
                name="i-heroicons-photo"
                class="mx-auto text-4xl text-neutral-400 dark:text-neutral-600"
              />
              <p class="text-sm font-medium text-black dark:text-white">
                {{ $t('create_product.drag_drop_hint') }}
              </p>
              <p class="text-xs text-neutral-400 dark:text-neutral-600">
                {{ $t('create_product.image_formats') }}
              </p>
            </div>
          </div>

          <!-- Error message for images -->
          <p
            v-if="errors.images"
            class="text-xs text-red-500 dark:text-red-400 mt-2"
          >
            {{ errors.images }}
          </p>

          <!-- Image Preview -->
          <div
            v-if="uploadedImages.length > 0"
            class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div
              v-for="(image, index) in uploadedImages"
              :key="index"
              class="relative group"
            >
              <img
                :src="image.src"
                :alt="`Image ${index + 1}`"
                class="w-full h-32 object-cover rounded-xl border-2 border-transparent dark:border-white/20"
              />
              <button
                type="button"
                @click="removeImage(index)"
                class="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition"
              >
                <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Message -->
        <div
          v-if="message"
          :class="[
            'p-4 rounded-xl',
            message && message.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
          ]"
        >
          {{ message && message.text }}
        </div>

        <!-- Submit Button -->
        <div class="flex gap-4">
          <button
            type="submit"
            :disabled="isSubmitting"
            class="flex-1 px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            <span v-if="!isSubmitting">{{ $t('create_product.create_button') }}</span>
            <span v-else class="flex items-center justify-center gap-2">
              <UIcon name="i-svg-spinners-90-ring-with-bg" class="w-5 h-5" />
              {{ $t('create_product.creating') }}
            </span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* Additional styles if needed */
</style>

<style>
/* Select2 height matching input fields */
.select2-container--default .select2-selection--single {
  height: 48px !important;
  border: 2px solid rgb(229 229 229) !important;
  border-radius: 0.75rem !important;
  background-color: rgba(255, 255, 255, 0.8) !important;
}

.dark .select2-container--default .select2-selection--single {
  border-color: rgb(55 65 81) !important;
  border-color: rgb(198, 243, 198) !important;
}

.select2-container--default
  .select2-selection--single
  .select2-selection__rendered {
  line-height: 44px !important;
  padding-left: 16px !important;
  padding-right: 32px !important;
  color: rgb(0, 0, 0) !important;
}

.dark
  .select2-container--default
  .select2-selection--single
  .select2-selection__rendered {
  color: rgb(255, 255, 255) !important;
}

.select2-container--default
  .select2-selection--single
  .select2-selection__arrow {
  height: 46px !important;
  right: 8px !important;
}

.select2-container--default.select2-container--focus
  .select2-selection--single {
  border-color: rgb(198, 243, 198) !important;
}

.dark
  .select2-container--default.select2-container--focus
  .select2-selection--single {
  border-color: rgb(255, 255, 255) !important;
}

/* Error state */
.select2-container--default.select2-container--error
  .select2-selection--single {
  border-color: rgb(239 68 68) !important;
}

/* Disabled state */
.select2-container--default.select2-container--disabled
  .select2-selection--single {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
}

/* Select2 Multiple Selection */
.select2-container--default .select2-selection--multiple {
  min-height: 48px !important;
  border: 2px solid rgb(229 229 229) !important;
  border-radius: 0.75rem !important;
  background-color: rgba(255, 255, 255, 0.8) !important;
  padding: 4px 8px !important;
}

.dark .select2-container--default .select2-selection--multiple {
  border-color: rgb(55 65 81) !important;
  background-color: rgba(0, 0, 0, 0.2) !important;
}

.select2-container--default
  .select2-selection--multiple
  .select2-selection__rendered {
  padding: 0 !important;
  min-height: 36px !important;
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: 2px !important;
}

.select2-container--default
  .select2-selection--multiple
  .select2-selection__choice {
  background-color: rgb(0, 0, 0) !important;
  border: none !important;
  border-radius: 0.5rem !important;
  padding: 4px 8px !important;
  margin: 2px !important;
  color: rgb(255, 255, 255) !important;
  font-size: 0.875rem !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: fit-content !important;
  max-width: 100% !important;
  position: relative !important;
}

.dark
  .select2-container--default
  .select2-selection--multiple
  .select2-selection__choice {
  background-color: rgb(255, 255, 255) !important;
  color: rgb(0, 0, 0) !important;
}

.select2-container--default
  .select2-selection--multiple
  .select2-selection__choice__remove {
  color: rgb(255, 255, 255) !important;
  border: none !important;
  padding: 0 !important;
  cursor: pointer !important;
  position: absolute !important;
  right: 5px !important;
  top: -2px !important;
  width: fit-content !important;
  left: inherit !important;
}

.select2-container--default
  .select2-selection--multiple
  .select2-selection__choice__remove:hover {
  color: rgb(255, 255, 255) !important;
  background: transparent !important;
  border: none !important;
}

.dark
  .select2-container--default
  .select2-selection--multiple
  .select2-selection__choice__remove {
  color: rgb(0, 0, 0) !important;
  border: none !important;
  position: absolute !important;
  right: 5px !important;
  top: -2px !important;
  width: fit-content !important;
  left: inherit !important;
}

.dark
  .select2-container--default
  .select2-selection--multiple
  .select2-selection__choice__remove:hover {
  color: rgb(0, 0, 0) !important;
  background: transparent !important;
  border: none !important;
}

.select2-container--default
  .select2-selection--multiple
  .select2-search--inline
  .select2-search__field {
  margin-top: 4px !important;
  padding: 4px 8px !important;
  height: 36px !important;
  color: rgb(0, 0, 0) !important;
}

.dark
  .select2-container--default
  .select2-selection--multiple
  .select2-search--inline
  .select2-search__field {
  color: rgb(255, 255, 255) !important;
}

.select2-container--default.select2-container--focus
  .select2-selection--multiple {
  border-color: rgb(198, 243, 198) !important;
}

.dark
  .select2-container--default.select2-container--focus
  .select2-selection--multiple {
  border-color: rgb(255, 255, 255) !important;
}

/* Quill Editor Styles */
.quill-editor :deep(.ql-container) {
  height: 300px;
  font-size: 14px;
  color: rgb(0, 0, 0);
}

.dark .quill-editor :deep(.ql-container) {
  color: rgb(255, 255, 255);
}

.quill-editor :deep(.ql-editor) {
  min-height: 300px;
  color: rgb(0, 0, 0);
}

.dark .quill-editor :deep(.ql-editor) {
  color: rgb(255, 255, 255);
}

.quill-editor :deep(.ql-toolbar) {
  border-top-left-radius: 0.75rem;
  border-top-right-radius: 0.75rem;
  border-bottom: 1px solid rgb(229, 229, 229);
  background-color: rgba(255, 255, 255, 0.8);
}

.dark .quill-editor :deep(.ql-toolbar) {
  border-bottom-color: rgb(55, 65, 81);
  background-color: rgba(0, 0, 0, 0.2);
}

.quill-editor :deep(.ql-container) {
  border-bottom-left-radius: 0.75rem;
  border-bottom-right-radius: 0.75rem;
  border-top: none;
}

.quill-editor :deep(.ql-stroke) {
  stroke: rgb(0, 0, 0);
}

.dark .quill-editor :deep(.ql-stroke) {
  stroke: rgb(255, 255, 255);
}

.quill-editor :deep(.ql-fill) {
  fill: rgb(0, 0, 0);
}

.dark .quill-editor :deep(.ql-fill) {
  fill: rgb(255, 255, 255);
}

.quill-editor :deep(.ql-picker-label) {
  color: rgb(0, 0, 0);
}

.dark .quill-editor :deep(.ql-picker-label) {
  color: rgb(255, 255, 255);
}

/* Short Description Editor - Smaller height */
.quill-editor-short :deep(.ql-container) {
  min-height: 120px;
  font-size: 14px;
}

.quill-editor-short :deep(.ql-editor) {
  min-height: 120px;
}

.quill-editor-short :deep(.ql-toolbar) {
  border-top-left-radius: 0.75rem;
  border-top-right-radius: 0.75rem;
  border-bottom: 1px solid rgb(229, 229, 229);
  background-color: rgba(255, 255, 255, 0.8);
}

.dark .quill-editor-short :deep(.ql-toolbar) {
  border-bottom-color: rgb(55, 65, 81);
  background-color: rgba(0, 0, 0, 0.2);
}

.quill-editor-short :deep(.ql-container) {
  border-bottom-left-radius: 0.75rem;
  border-bottom-right-radius: 0.75rem;
  border-top: none;
}

.quill-editor-short :deep(.ql-stroke) {
  stroke: rgb(0, 0, 0);
}

.dark .quill-editor-short :deep(.ql-stroke) {
  stroke: rgb(255, 255, 255);
}

.quill-editor-short :deep(.ql-fill) {
  fill: rgb(0, 0, 0);
}

.dark .quill-editor-short :deep(.ql-fill) {
  fill: rgb(255, 255, 255);
}

.quill-editor-short :deep(.ql-picker-label) {
  color: rgb(0, 0, 0);
}

.dark .quill-editor-short :deep(.ql-picker-label) {
  color: rgb(255, 255, 255);
}
</style>
