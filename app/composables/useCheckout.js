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

  // Load customer data from profile when authenticated
  const loadCustomerData = async () => {
    if (!isAuthenticated.value || !user.value) {
      return;
    }

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

      if (customerData.success && customerData.billing) {
        // Store billing data for checkout
        customerBillingData.value = customerData.billing;
        
        // Update userDetails for display only
        const billing = customerData.billing;
        if (billing.email) {
          userDetails.value.email = billing.email;
        }
        if (billing.first_name) {
          userDetails.value.firstName = billing.first_name;
        }
        if (billing.last_name) {
          userDetails.value.lastName = billing.last_name;
        }
        if (billing.phone) {
          userDetails.value.phone = billing.phone;
        }
        if (billing.address1) {
          userDetails.value.address1 = billing.address1;
        }
        if (billing.address2) {
          userDetails.value.address2 = billing.address2;
        }
        if (billing.city) {
          userDetails.value.city = billing.city;
        }
        if (billing.state) {
          userDetails.value.state = billing.state;
        }
        if (billing.postcode) {
          userDetails.value.postcode = billing.postcode;
        }
        if (billing.country) {
          userDetails.value.country = billing.country;
        }
      }
    } catch (err) {
      console.error('[useCheckout] Error loading customer data:', err);
      // Don't show error to user, just use empty form
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
      // Prepare line items from cart
      const line_items = cart.value.map(item => {
        // For variable products, use variation node
        // For simple products, use product node
        const variationNode = item.variation?.node;
        const productNode = item.product?.node;
        const node = variationNode || productNode || {};
        
        // Get databaseId from variation (variable) or product (simple)
        const productId = variationNode?.databaseId || productNode?.databaseId || node.databaseId || node.id || 0;
        
        const regularPrice = parseFloat(node.regularPrice) || 0;
        const salePrice = parseFloat(node.salePrice) || 0;
        const price = salePrice > 0 && salePrice < regularPrice ? salePrice : regularPrice;
        
        return {
          product_id: productId,
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
