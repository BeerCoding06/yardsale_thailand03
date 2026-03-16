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

  const handleCheckout = async () => {
    if (!isAuthenticated.value || !user.value) {
      error.value = 'กรุณาเข้าสู่ระบบก่อนสั่งซื้อ';
      return;
    }

    if (!cart.value || cart.value.length === 0) {
      error.value = 'ตะกร้าสินค้าว่างเปล่า';
      return;
    }


    // Validate required fields from form
    if (!userDetails.value.email || !userDetails.value.firstName || 
        !userDetails.value.lastName || !userDetails.value.phone || 
        !userDetails.value.address1 || !userDetails.value.city) {
      error.value = t('checkout.error.incomplete_data');
      return;
    }

    checkoutStatus.value = 'processing';
    error.value = null;

    try {
      // Parse price (handles HTML like "<span>500</span>" or "฿500.00")
      const parsePrice = (val) => {
        if (val == null || val === '') return 0;
        const cleaned = String(val).replace(/<[^>]*>/g, '').replace(/[^0-9.]/g, '');
        const n = parseFloat(cleaned);
        return Number.isFinite(n) ? n : 0;
      };

      // Prepare line items from cart (product_id from databaseId or id; price from regularPrice/salePrice)
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

      // Get customer ID from logged-in user
      const customerId = user.value.id || user.value.ID;

      // Use billing data from form (user can enter new data)
      const checkoutData = {
        customer_id: customerId, // Use logged-in user's ID as customer
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
        payment_method: 'cod',
        payment_method_title: 'ชำระเงินปลายทาง',
        set_paid: false,
        status: 'pending',
        line_items: line_items,
      };

      console.log('[useCheckout] Sending checkout data:', checkoutData);

      const res = await $fetch('/api/create-order', {
        method: 'POST',
        body: checkoutData,
      });

      console.log('[useCheckout] Order created:', res);

      // Clear cart
      cart.value = [];
      if (import.meta.client) {
        localStorage.setItem('cart', JSON.stringify(cart.value));
      }

      // Store order data
      order.value = res.order;

      checkoutStatus.value = 'success';

      // Redirect to success page after a short delay
      setTimeout(() => {
        router.push('/payment-successful');
      }, 1500);
    } catch (err) {
      console.error('[useCheckout] Error:', err);
      error.value = err?.data?.error || err?.message || t('checkout.error.create_order_failed');
      checkoutStatus.value = 'order';
    }
  };

  return { 
    order, 
    userDetails, 
    checkoutStatus, 
    error, 
    handleCheckout,
    loadCustomerData,
    isLoadingCustomerData,
    customerBillingData: readonly(customerBillingData),
  };
};
