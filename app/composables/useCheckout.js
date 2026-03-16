export const useCheckout = () => {
  const { cart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const order = useState('order', () => {});
  const userDetails = useState('userDetails', () => ({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    address1: '',
    address2: '',
    state: '',
    postcode: '',
    country: 'TH',
  }));
  const checkoutStatus = ref('order');
  const error = ref(null);
  const isLoadingCustomerData = ref(false);
  const paymentMethod = ref('cod'); // 'cod' | 'promptpay' | 'credit_card'
  const showPaymentChoiceModal = ref(false);

  // Store customer billing data from profile
  const customerBillingData = ref(null);

  /** เติมฟอร์มจากข้อมูล user ที่ login (email, ชื่อ) – เรียกก่อนโหลดจาก API */
  const fillUserDetailsFromLogin = () => {
    const u = user.value;
    if (!u) return;
    if (u.email || u.user_email) {
      userDetails.value.email = u.email || u.user_email || '';
    }
    if (u.first_name) {
      userDetails.value.firstName = u.first_name;
    }
    if (u.last_name) {
      userDetails.value.lastName = u.last_name;
    }
    if (!userDetails.value.firstName && !userDetails.value.lastName && (u.name || u.display_name)) {
      const fullName = (u.name || u.display_name || '').trim();
      const parts = fullName.split(/\s+/);
      if (parts.length >= 2) {
        userDetails.value.firstName = parts[0];
        userDetails.value.lastName = parts.slice(1).join(' ');
      } else if (parts.length === 1) {
        userDetails.value.firstName = parts[0];
      }
    }
    if (u.phone) {
      userDetails.value.phone = u.phone;
    }
  };

  // โหลดข้อมูลลูกค้า: เติมจาก login ก่อน แล้วดึงจาก API (ถ้ามี) มาเขียนทับ
  const loadCustomerData = async () => {
    if (!isAuthenticated.value || !user.value) {
      return;
    }

    // เติมจากข้อมูล login ทันที (email, ชื่อ)
    fillUserDetailsFromLogin();

    try {
      isLoadingCustomerData.value = true;
      const customerId = user.value.id || user.value.ID;
      const customerEmail = user.value.email || user.value.user_email;

      const queryParams = new URLSearchParams();
      if (customerId) {
        queryParams.append('customer_id', String(customerId));
      }
      if (customerEmail) {
        queryParams.append('customer_email', customerEmail);
      }

      const customerData = await $fetch(`/api/get-customer-data?${queryParams.toString()}`);

      // ถ้า API ส่ง billing มา (จาก WooCommerce/WordPress) ใช้เขียนทับ
      const billing = customerData?.billing ?? customerData?.customer;
      if (billing && typeof billing === 'object') {
        customerBillingData.value = billing;
        if (billing.email) userDetails.value.email = billing.email;
        if (billing.first_name) userDetails.value.firstName = billing.first_name;
        if (billing.last_name) userDetails.value.lastName = billing.last_name;
        if (billing.phone) userDetails.value.phone = billing.phone || '';
        if (billing.address_1 || billing.address1) userDetails.value.address1 = billing.address_1 || billing.address1 || '';
        if (billing.address_2 || billing.address2) userDetails.value.address2 = billing.address_2 || billing.address2 || '';
        if (billing.city) userDetails.value.city = billing.city || '';
        if (billing.state) userDetails.value.state = billing.state || '';
        if (billing.postcode) userDetails.value.postcode = billing.postcode || '';
        if (billing.country) userDetails.value.country = billing.country || 'TH';
      }
    } catch (err) {
      console.error('[useCheckout] Error loading customer data:', err);
      // ยังมีข้อมูลจาก login อยู่แล้ว ไม่ต้องแสดง error
    } finally {
      isLoadingCustomerData.value = false;
    }
  };

  /** สร้าง items สำหรับ check-cart-stock จาก cart (product_id = parent, variation_id = variation เมื่อเป็นตัวแปร) */
  const getCartItemsForStockCheck = () => {
    if (!cart.value || !cart.value.length) return [];
    return cart.value.map((item) => {
      const parentId = item.product?.node?.databaseId ?? item.product?.node?.id;
      const variationId = item.variation?.node?.databaseId ?? item.variation?.node?.id;
      const isVariation = item.variation?.node != null;
      const product_id = isVariation ? Number(parentId) : Number(item.product?.node?.databaseId ?? item.product?.node?.id ?? 0);
      return {
        product_id: product_id || 0,
        ...(isVariation && variationId != null && { variation_id: Number(variationId) }),
        quantity: item.quantity || 1,
      };
    }).filter((i) => i.product_id > 0);
  };

  /** ตรวจสต็อกจากข้อมูลใน cart (client-side) ใช้ disable ปุ่ม */
  const isCartStockValid = () => {
    for (const item of cart.value || []) {
      const node = item.variation?.node || item.product?.node || {};
      const stockStatus = (node.stockStatus ?? '').toString().toUpperCase().replace(/\s/g, '_');
      const stockQuantity = node.stockQuantity != null ? Number(node.stockQuantity) : null;
      const qty = item.quantity || 1;
      if (stockStatus === 'OUT_OF_STOCK' || stockStatus === 'OUTOFSTOCK') return false;
      if (stockQuantity !== null && stockQuantity < 1) return false;
      if (stockQuantity !== null && qty > stockQuantity) return false;
    }
    return true;
  };

  /** กดปุ่มชำระเงิน: validate + ตรวจสต็อก (API) แล้วเปิด modal เลือกวิธีชำระ */
  const handleCheckout = async () => {
    if (!isAuthenticated.value || !user.value) {
      error.value = 'กรุณาเข้าสู่ระบบก่อนสั่งซื้อ';
      return;
    }
    if (!cart.value || cart.value.length === 0) {
      error.value = 'ตะกร้าสินค้าว่างเปล่า';
      return;
    }
    if (!userDetails.value.email || !userDetails.value.firstName ||
        !userDetails.value.lastName || !userDetails.value.phone ||
        !userDetails.value.address1 || !userDetails.value.city) {
      error.value = t('checkout.error.incomplete_data');
      return;
    }

    const items = getCartItemsForStockCheck();
    if (items.length > 0) {
      try {
        const res = await $fetch('/api/check-cart-stock', { method: 'POST', body: { items } });
        if (!res.valid && res.errors?.length) {
          error.value = res.errors[0].message + (res.errors[0].name ? ` (${res.errors[0].name})` : '');
          return;
        }
      } catch (e) {
        error.value = t('checkout.error.stock_check_failed') || 'ตรวจสต็อกไม่สำเร็จ';
        return;
      }
    }

    error.value = null;
    showPaymentChoiceModal.value = true;
  };

  /** เลือกวิธีชำระจาก modal แล้วสร้างออเดอร์และ redirect ตามวิธีที่เลือก */
  const executeCheckout = async (method) => {
    if (!['promptpay', 'credit_card'].includes(method)) return;
    paymentMethod.value = method;
    showPaymentChoiceModal.value = false;
    checkoutStatus.value = 'processing';
    error.value = null;

    try {
      const parsePrice = (val) => {
        if (val == null || val === '') return 0;
        const cleaned = String(val).replace(/<[^>]*>/g, '').replace(/[^0-9.]/g, '');
        const n = parseFloat(cleaned);
        return Number.isFinite(n) ? n : 0;
      };

      const line_items = cart.value.map(item => {
        const variationNode = item.variation?.node;
        const productNode = item.product?.node;
        const node = variationNode || productNode || {};
        const productId = variationNode?.databaseId ?? productNode?.databaseId ?? node.databaseId ?? node.id ?? 0;
        const regularPrice = parsePrice(node.regularPrice);
        const salePrice = parsePrice(node.salePrice);
        const price = salePrice > 0 && salePrice < regularPrice ? salePrice : regularPrice;
        return {
          product_id: Number(productId) || 0,
          quantity: item.quantity || 1,
          price: price,
        };
      }).filter(item => item.product_id > 0);

      if (line_items.length === 0) {
        throw new Error(t('checkout.error.no_valid_items'));
      }

      const customerId = user.value.id || user.value.ID;
      const isPromptPay = method === 'promptpay';
      const isCreditCard = method === 'credit_card';
      const paymentTitle = isPromptPay ? 'PromptPay (Omise)' : isCreditCard ? 'บัตรเครดิต (Omise)' : 'ชำระเงินปลายทาง';
      const checkoutData = {
        customer_id: customerId,
        billing: {
          email: userDetails.value.email,
          firstName: userDetails.value.firstName,
          lastName: userDetails.value.lastName,
          phone: userDetails.value.phone,
          address1: userDetails.value.address1,
          address2: userDetails.value.address2 || '',
          city: userDetails.value.city,
          state: userDetails.value.state || '',
          postcode: userDetails.value.postcode || '',
          country: userDetails.value.country || 'TH',
        },
        payment_method: method,
        payment_method_title: paymentTitle,
        set_paid: false,
        status: 'pending',
        line_items: line_items,
      };

      const jwtToken = user.value?.token;
      const res = await $fetch('/api/create-order', {
        method: 'POST',
        body: checkoutData,
        ...(jwtToken ? { headers: { Authorization: `Bearer ${jwtToken}` } } : {}),
      });

      const orderData = res.order;
      order.value = orderData;
      const amountThb = Number(orderData.total) || line_items.reduce((s, i) => s + (Number(i.price) || 0) * (i.quantity || 1), 0);

      if (isPromptPay && orderData?.id) {
        const chargeRes = await $fetch('/api/omise-create-charge', {
          method: 'POST',
          body: {
            order_id: orderData.id,
            amount_thb: amountThb,
            return_uri: typeof window !== 'undefined' ? `${window.location.origin}/payment-successful?order_id=${orderData.id}` : undefined,
          },
        });
        const hasQr = chargeRes?.qr_image_uri || chargeRes?.scannable_code;
        if (hasQr && import.meta.client) {
          cart.value = [];
          if (import.meta.client) localStorage.setItem('cart', JSON.stringify(cart.value));
          const params = new URLSearchParams({ order_id: orderData.id, amount: amountThb });
          if (chargeRes.qr_image_uri) params.set('qr_uri', chargeRes.qr_image_uri);
          if (chargeRes.scannable_code) params.set('code', chargeRes.scannable_code);
          await router.push(`/payment-promptpay?${params.toString()}`);
          return;
        }
        if (chargeRes?.authorize_uri) {
          cart.value = [];
          if (import.meta.client) localStorage.setItem('cart', JSON.stringify(cart.value));
          if (import.meta.client) window.location.href = chargeRes.authorize_uri;
          return;
        }
        error.value = chargeRes?.message || 'ไม่สามารถสร้างลิงก์ชำระ PromptPay ได้';
        checkoutStatus.value = 'order';
        return;
      }

      if (isCreditCard && orderData?.id) {
        cart.value = [];
        if (import.meta.client) localStorage.setItem('cart', JSON.stringify(cart.value));
        await router.push(`/payment-creditcard?order_id=${orderData.id}&amount=${amountThb}`);
        return;
      }

      checkoutStatus.value = 'order';
    } catch (err) {
      console.error('[useCheckout] Error:', err);
      error.value = err?.data?.error || err?.message || t('checkout.error.create_order_failed');
      checkoutStatus.value = 'order';
    }
  };

  const closePaymentChoiceModal = () => {
    showPaymentChoiceModal.value = false;
  };

  return {
    order,
    userDetails,
    checkoutStatus,
    error,
    handleCheckout,
    executeCheckout,
    closePaymentChoiceModal,
    showPaymentChoiceModal,
    loadCustomerData,
    isLoadingCustomerData,
    customerBillingData: readonly(customerBillingData),
    paymentMethod,
    isCartStockValid,
  };
};
