// app/composables/useCart.ts
import { push } from 'notivue';

export const useCart = () => {
  const { t } = useI18n();
  const cart = useState<CartItem[]>('cart', () => []);
  const addToCartButtonStatus = ref<AddBtnStatus>('add');

  const findItem = (productId: number) => {
    // For simple products, check product.node.databaseId
    // For variable products, check variation.node.databaseId
    return cart.value.find(i => 
      i.product?.node?.databaseId === productId || 
      i.variation?.node?.databaseId === productId
    );
  };

  const updateCart = (next: CartItem[]) => {
    console.log('[useCart] updateCart called with', next.length, 'items');
    cart.value = next;
    if (import.meta.client) {
      localStorage.setItem('cart', JSON.stringify(next));
      console.log('[useCart] Cart saved to localStorage');
    }
    console.log('[useCart] Cart state updated, current length:', cart.value.length);
  };

  const handleAddToCart = async (productId: number) => {
    try {
      addToCartButtonStatus.value = 'loading';
      
      // Check if item already exists in cart to calculate total quantity
      const existingItem = findItem(productId);
      const currentQuantity = existingItem?.quantity || 0;
      const requestedQuantity = currentQuantity + 1;
      
      console.log('[useCart] Calling /api/cart/add with productId:', productId);
      
      // Use $fetch with explicit relative path - no baseURL to avoid any redirects
      const res = await $fetch<AddToCartResponse>('/api/cart/add', { 
        method: 'POST', 
        body: { productId },
      });
      
      console.log('[useCart] Response from /api/cart/add:', res);
      
      if (!res || !res.addToCart || !res.addToCart.cartItem) {
        console.error('[useCart] Invalid response structure:', res);
        throw new Error('Invalid response from add to cart API');
      }
      
      const incoming = res.addToCart.cartItem;
      console.log('[useCart] Incoming cart item:', incoming);
      console.log('[useCart] Current cart items:', cart.value.length);
      
      const idx = cart.value.findIndex(i => i.key === incoming.key);

      if (idx > -1) {
        console.log('[useCart] Item already exists in cart, updating quantity');
        const existingItem = cart.value[idx];
        const merged = { 
          ...existingItem, 
          ...incoming,
          // Increment quantity instead of replacing it
          quantity: existingItem.quantity + (incoming.quantity || 1)
        };
        
        // Update stock quantity for both simple and variable products
        if (incoming.variation?.node && typeof incoming.variation.node.stockQuantity === 'number') {
          if (merged.variation?.node) {
            merged.variation.node.stockQuantity = incoming.variation.node.stockQuantity;
            merged.variation.node.stockStatus = incoming.variation.node.stockStatus;
          }
        } else if (incoming.product?.node && typeof incoming.product.node.stockQuantity === 'number') {
          // For simple products, stock quantity is on product node
          if (merged.product?.node) {
            merged.product.node.stockQuantity = incoming.product.node.stockQuantity;
            merged.product.node.stockStatus = incoming.product.node.stockStatus;
          }
        }
        const updatedCart = [...cart.value.slice(0, idx), merged, ...cart.value.slice(idx + 1)];
        console.log('[useCart] Updated cart:', updatedCart);
        console.log('[useCart] Updated cart length:', updatedCart.length);
        updateCart(updatedCart);
      } else {
        console.log('[useCart] Adding new item to cart');
        const updatedCart = [...cart.value, incoming];
        console.log('[useCart] New cart:', updatedCart);
        console.log('[useCart] New cart length:', updatedCart.length);
        updateCart(updatedCart);
      }
      
      console.log('[useCart] Final cart state after update:', cart.value.length, 'items');

      addToCartButtonStatus.value = 'added';
      setTimeout(() => (addToCartButtonStatus.value = 'add'), 2000);
    } catch (err: any) {
      addToCartButtonStatus.value = 'add';
      
      // Log full error for debugging
      console.error('[useCart] handleAddToCart error:', err);
      console.error('[useCart] Error URL:', err?.url);
      console.error('[useCart] Error statusCode:', err?.statusCode);
      console.error('[useCart] Error data:', err?.data);
      
      // Extract error message from various possible locations
      let errorMessage = '';
      if (err?.data?.error) {
        errorMessage = String(err.data.error || '');
      } else if (err?.data?.message) {
        errorMessage = String(err.data.message || '');
      } else if (err?.message) {
        errorMessage = String(err.message || '');
      } else if (err?.statusMessage) {
        errorMessage = String(err.statusMessage || '');
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      // If still no message, use default
      if (!errorMessage || (typeof errorMessage === 'string' && errorMessage.trim() === '')) {
        errorMessage = t('cart.add_error');
      }
      
      // Ensure errorMessage is a string
      errorMessage = String(errorMessage || t('cart.add_error'));
      
      console.error('[useCart] Displaying error message:', errorMessage);
      push.error(errorMessage);
    }
  };

  const changeQty = async (key: string, quantity: number) => {
    const item = cart.value.find(i => i.key === key);
    if (!item) return;
    
    if (quantity <= 0) {
      // Allow removing items - call removeItem instead
      removeItem(key);
      return;
    }
    
    // Check stock before updating quantity
    const stockQuantity = item.variation?.node?.stockQuantity ?? 
                         item.product?.node?.stockQuantity ?? 
                         null;
    const stockStatus = (item.variation?.node?.stockStatus ?? 
                        item.product?.node?.stockStatus ?? 
                        '').toUpperCase();
    
    // Check if product is out of stock (support multiple formats)
    if (stockStatus === 'OUT_OF_STOCK' || stockStatus === 'OUTOFSTOCK' || stockStatus === 'OUT OF STOCK') {
      push.error(t('cart.out_of_stock'));
      return;
    }
    
    // Check if quantity exceeds stock (only if managing stock)
    if (stockQuantity !== null && quantity > stockQuantity) {
      push.error(t('cart.insufficient_stock'));
      return;
    }
    
    try {
      await $fetch('/api/cart/update', { method: 'POST', body: { items: [{ key, quantity }] } });
      updateCart(cart.value.map(i => (i.key === key ? { ...i, quantity } : i)));
      // Don't show notification on successful quantity change
    } catch (err: any) {
      console.error('[useCart] changeQty error:', err);
      
      // Extract error message
      let errorMessage = '';
      if (err?.data?.error) {
        errorMessage = String(err.data.error);
      } else if (err?.data?.message) {
        errorMessage = String(err.data.message);
      } else if (err?.message) {
        errorMessage = String(err.message);
      } else if (err?.statusMessage) {
        errorMessage = String(err.statusMessage);
      }
      
      // Only show error if it's related to stock or a critical error
      if (errorMessage && typeof errorMessage === 'string' && (errorMessage.includes('stock') || errorMessage.includes('Stock') || 
          errorMessage.includes('out of stock') || errorMessage.includes('insufficient'))) {
        push.error(errorMessage);
      } else if (err?.statusCode >= 400 && err?.statusCode < 500) {
        push.error(errorMessage || t('cart.update_error'));
      }
    }
  };

  const increment = (productId: number) => {
    const item = findItem(productId);
    if (!item) {
      handleAddToCart(productId);
      return;
    }
    // Check stock quantity from variation (variable) or product (simple)
    const max = item.variation?.node?.stockQuantity ?? 
                item.product?.node?.stockQuantity ?? 
                Infinity;
    // Only check if managing stock (max is not Infinity)
    if (max !== Infinity && item.quantity >= max) {
      push.error(t('cart.insufficient_stock'));
      return;
    }
    changeQty(item.key, item.quantity + 1);
  };

  const decrement = (productId: number) => {
    const item = findItem(productId);
    if (!item) return;
    const newQuantity = item.quantity - 1;
    if (newQuantity <= 0) {
      removeItem(item.key);
    } else {
      changeQty(item.key, newQuantity);
    }
  };

  const removeItem = async (key: string) => {
    const item = cart.value.find(i => i.key === key);
    if (!item) return;
    
    try {
      // Remove via update API with quantity 0
      await $fetch('/api/cart/update', { method: 'POST', body: { items: [{ key, quantity: 0 }] } });
      // Update local cart after successful removal
      updateCart(cart.value.filter(i => i.key !== key));
      // Don't show notification on successful removal
    } catch (err: any) {
      console.error('[useCart] Failed to remove item from server cart:', err);
      // Still remove from local cart even if API call fails
      updateCart(cart.value.filter(i => i.key !== key));
      // Only show error if it's a critical error (not just a network issue)
      if (err?.statusCode >= 400 && err?.statusCode < 500) {
        let errorMessage = '';
        if (err?.data?.error) {
          errorMessage = err.data.error;
        } else if (err?.data?.message) {
          errorMessage = err.data.message;
        } else if (err?.message) {
          errorMessage = err.message;
        } else if (err?.statusMessage) {
          errorMessage = err.statusMessage;
        }
        
        if (!errorMessage || errorMessage.trim() === '') {
          errorMessage = t('cart.remove_error');
        }
        
        push.error(errorMessage);
      }
    }
  };

  onMounted(() => {
    if (!import.meta.client) return;
    const stored = localStorage.getItem('cart');
    console.log('[useCart] Loading cart from localStorage:', stored ? 'found' : 'not found');
    if (!stored) {
      console.log('[useCart] No cart data in localStorage, starting with empty cart');
      return;
    }
    try {
      const parsed = JSON.parse(stored) as CartItem[];
      console.log('[useCart] Parsed cart data:', parsed);
      console.log('[useCart] Cart items count:', parsed.length);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Validate cart items structure
        const validItems = parsed.filter(item => {
          const isValid = item && 
            typeof item.key === 'string' && 
            typeof item.quantity === 'number' &&
            item.product && 
            item.product.node;
          if (!isValid) {
            console.warn('[useCart] Invalid cart item:', item);
          }
          return isValid;
        });
        console.log('[useCart] Valid cart items:', validItems.length);
        updateCart(validItems);
      } else {
        console.log('[useCart] Cart is empty or invalid');
        updateCart([]);
      }
    } catch (error) {
      console.error('[useCart] Error parsing cart from localStorage:', error);
      updateCart([]);
    }
  });

  return {
    cart,
    addToCartButtonStatus,
    handleAddToCart,
    increment,
    decrement,
    removeItem,
  };
};
