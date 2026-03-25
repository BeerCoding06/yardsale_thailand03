// app/composables/useCart.ts
import { push } from 'notivue';
import { isCartLineSalableBySnapshot } from '~/utils/cart-line-salable';
import { wcStatusToCartStockToken } from '~/utils/stock-status-format';
import { serverCartRowsToCartItems, yardsaleProductRowToCartItem } from '~/utils/yardsaleCart';
import { unwrapYardsaleResponse } from '~/utils/cmsApiEndpoint';
import type { CartItem } from '~~/shared/types';

export const useCart = () => {
  const { t } = useI18n();
  const { hasRemoteApi, endpoint, resolveMediaUrl, isStorefrontPublishedProduct } =
    useStorefrontCatalog();
  const { user, isAuthenticated } = useAuth();
  const cart = useState<CartItem[]>('cart', () => []);
  const addToCartButtonStatus = ref<AddBtnStatus>('add');

  const authHeaders = (): Record<string, string> => {
    const tok = user.value?.token;
    if (!tok) return {};
    return { Authorization: `Bearer ${tok}` };
  };

  const findItem = (productId: number | string) => {
    const want = String(productId);
    return cart.value.find((i) => {
      const p = i.product?.node?.databaseId ?? i.product?.node?.id;
      const v = i.variation?.node?.databaseId ?? i.variation?.node?.id;
      return String(p) === want || String(v) === want;
    });
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

  /** parentProductId = WooCommerce parent product id เมื่อ productId คือ variation id */
  const handleAddToCart = async (productId: number | string, parentProductId?: number) => {
    try {
      addToCartButtonStatus.value = 'loading';

      if (hasRemoteApi) {
        const product_id = String(productId);
        if (!isAuthenticated.value || !user.value?.token) {
          const raw = await $fetch<unknown>(endpoint(`product/${product_id}`));
          const data = unwrapYardsaleResponse(raw) as {
            product?: Record<string, unknown>;
          } | null;
          const p = data?.product ?? (data as Record<string, unknown> | null);
          if (!p || typeof p !== 'object' || p.id == null) {
            push.error(t('cart.add_error'));
            addToCartButtonStatus.value = 'add';
            return;
          }
          if (!isStorefrontPublishedProduct(p)) {
            push.error(t('cart.add_error'));
            addToCartButtonStatus.value = 'add';
            return;
          }
          const stock = Number((p as { stock?: unknown }).stock ?? 0);
          const existingItem = findItem(productId);
          const nextQty = (existingItem?.quantity || 0) + 1;
          if (stock < nextQty) {
            push.error(t('cart.insufficient_stock'));
            addToCartButtonStatus.value = 'add';
            return;
          }
          const line = yardsaleProductRowToCartItem(p, nextQty, resolveMediaUrl);
          if (!line) {
            push.error(t('cart.add_error'));
            addToCartButtonStatus.value = 'add';
            return;
          }
          const idx = cart.value.findIndex((i) => i.key === line.key);
          if (idx > -1) {
            updateCart([...cart.value.slice(0, idx), line, ...cart.value.slice(idx + 1)]);
          } else {
            updateCart([...cart.value, line]);
          }
          addToCartButtonStatus.value = 'added';
          setTimeout(() => (addToCartButtonStatus.value = 'add'), 2000);
          return;
        }
        const prevSnapshot = cart.value
          .map((i) => ({
            pid: String(i.product?.node?.databaseId ?? i.product?.node?.id ?? ''),
            qty: i.quantity || 1,
          }))
          .filter((x) => x.pid);

        const raw = await $fetch<unknown>(endpoint('cart/add'), {
          method: 'POST',
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          body: { product_id, quantity: 1 },
        });
        const data = unwrapYardsaleResponse(raw) as { items?: unknown[] } | null;
        const rows = data?.items;
        let mapped = serverCartRowsToCartItems(
          rows as Parameters<typeof serverCartRowsToCartItems>[0],
          resolveMediaUrl
        ) as CartItem[];

        const serverItems = mapped
          .map((i) => ({
            product_id: String(i.product?.node?.databaseId ?? i.product?.node?.id ?? ''),
            quantity: i.quantity || 1,
          }))
          .filter((x) => x.product_id);
        const serverPidSet = new Set(serverItems.map((x) => x.product_id));
        const extras = prevSnapshot.filter((x) => !serverPidSet.has(x.pid));
        if (extras.length) {
          const mergedPayload = [
            ...serverItems,
            ...extras.map((x) => ({ product_id: x.pid, quantity: x.qty })),
          ];
          const raw2 = await $fetch<unknown>(endpoint('cart/update'), {
            method: 'POST',
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json',
            },
            body: { items: mergedPayload },
          });
          const data2 = unwrapYardsaleResponse(raw2) as { items?: unknown[] } | null;
          if (data2?.items && Array.isArray(data2.items)) {
            mapped = serverCartRowsToCartItems(
              data2.items as Parameters<typeof serverCartRowsToCartItems>[0],
              resolveMediaUrl
            ) as CartItem[];
          }
        }

        updateCart(mapped);
        addToCartButtonStatus.value = 'added';
        setTimeout(() => (addToCartButtonStatus.value = 'add'), 2000);
        return;
      }

      const existingItem = findItem(productId);
      const currentQuantity = existingItem?.quantity || 0;
      const requestedQuantity = currentQuantity + 1;

      console.log('[useCart] Calling /api/cart/add with productId:', productId, 'parentProductId:', parentProductId);

      const res = await $fetch<AddToCartResponse>('/api/cart/add', {
        method: 'POST',
        body: {
          productId,
          ...(parentProductId != null &&
            Number(parentProductId) > 0 && { parentProductId: Number(parentProductId) }),
        },
      });

      console.log('[useCart] Response from /api/cart/add:', res);

      if (!res || !res.addToCart || !res.addToCart.cartItem) {
        console.error('[useCart] Invalid response structure:', res);
        throw new Error('Invalid response from add to cart API');
      }

      const incoming = res.addToCart.cartItem;
      const idx = cart.value.findIndex((i) => i.key === incoming.key);

      if (idx > -1) {
        const prev = cart.value[idx];
        const merged = {
          ...prev,
          ...incoming,
          quantity: prev.quantity + (incoming.quantity || 1),
        };
        if (incoming.variation?.node && typeof incoming.variation.node.stockQuantity === 'number') {
          if (merged.variation?.node) {
            merged.variation.node.stockQuantity = incoming.variation.node.stockQuantity;
            merged.variation.node.stockStatus = incoming.variation.node.stockStatus;
          }
        } else if (incoming.product?.node && typeof incoming.product.node.stockQuantity === 'number') {
          if (merged.product?.node) {
            merged.product.node.stockQuantity = incoming.product.node.stockQuantity;
            merged.product.node.stockStatus = incoming.product.node.stockStatus;
          }
        }
        updateCart([...cart.value.slice(0, idx), merged, ...cart.value.slice(idx + 1)]);
      } else {
        updateCart([...cart.value, incoming]);
      }

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
      removeItem(key);
      return;
    }
    
    const stockQuantity = item.variation?.node?.stockQuantity ?? 
                         item.product?.node?.stockQuantity ?? 
                         null;
    const stockStatus = item.variation?.node?.stockStatus ?? item.product?.node?.stockStatus;

    if (!isCartLineSalableBySnapshot(stockStatus, stockQuantity, quantity)) {
      const norm = (stockStatus ?? '').toString().toUpperCase().replace(/\s/g, '_');
      if (norm === 'OUT_OF_STOCK' || norm === 'OUTOFSTOCK') {
        push.error(t('cart.out_of_stock'));
      } else {
        push.error(t('cart.insufficient_stock'));
      }
      return;
    }
    
    try {
      if (hasRemoteApi) {
        if (!user.value?.token) {
          updateCart(cart.value.map((i) => (i.key === key ? { ...i, quantity } : i)));
          return;
        }
        const nextItems = cart.value
          .map((i) => {
            const pid = String(i.product?.node?.databaseId ?? i.product?.node?.id ?? '');
            const q = i.key === key ? quantity : i.quantity || 1;
            return { product_id: pid, quantity: q };
          })
          .filter((x) => x.product_id && x.quantity > 0);
        const raw = await $fetch<unknown>(endpoint('cart/update'), {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: { items: nextItems },
        });
        const data = unwrapYardsaleResponse(raw) as { items?: unknown[] } | null;
        const mapped = serverCartRowsToCartItems(
          data?.items as Parameters<typeof serverCartRowsToCartItems>[0],
          resolveMediaUrl
        ) as CartItem[];
        updateCart(mapped);
        return;
      }

      await $fetch('/api/cart/update', { method: 'POST', body: { items: [{ key, quantity }] } });
      updateCart(cart.value.map(i => (i.key === key ? { ...i, quantity } : i)));
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

  const increment = (productId: number | string) => {
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

  const decrement = (productId: number | string) => {
    const item = findItem(productId);
    if (!item) return;
    const newQuantity = item.quantity - 1;
    if (newQuantity <= 0) {
      removeItem(item.key);
    } else {
      changeQty(item.key, newQuantity);
    }
  };

  /** โครงเดียวกับ `/api/check-cart-stock` และ `/api/refresh-cart-stock` */
  const getCartItemsForStockApi = () => {
    if (!cart.value || !cart.value.length) return [];
    if (hasRemoteApi) {
      return cart.value
        .map((item) => ({
          product_id: String(item.product?.node?.databaseId ?? item.product?.node?.id ?? ''),
          quantity: item.quantity || 1,
        }))
        .filter((i) => i.product_id.length > 0);
    }
    return cart.value
      .map((item) => {
        const parentId = item.product?.node?.databaseId ?? item.product?.node?.id;
        const variationId = item.variation?.node?.databaseId ?? item.variation?.node?.id;
        const isVariation = item.variation?.node != null;
        const product_id = isVariation
          ? Number(parentId)
          : Number(item.product?.node?.databaseId ?? item.product?.node?.id ?? 0);
        return {
          product_id: product_id || 0,
          ...(isVariation && variationId != null && { variation_id: Number(variationId) }),
          quantity: item.quantity || 1,
        };
      })
      .filter((i) => i.product_id > 0);
  };

  type RefreshLine = {
    product_id: number;
    variation_id?: number;
    quantity: number;
    name: string;
    stockQuantity: number | null;
    stockStatus: string;
  };

  /**
   * ดึงสต็อกล่าสุดจาก WC + ปลั๊กอิน แล้วเขียนลงตะกร้า (localStorage)
   * เรียกตอนเปิด Checkout — ลดข้อความ out of stock จาก snapshot เก่า
   */
  const refreshCartStockFromServer = async (): Promise<boolean> => {
    if (!import.meta.client || !cart.value?.length) return true;
    const items = getCartItemsForStockApi();
    if (!items.length) return true;
    try {
      if (hasRemoteApi) {
        if (!user.value?.token) {
          const next = await Promise.all(
            cart.value.map(async (item) => {
              const pid = String(
                item.product?.node?.databaseId ?? item.product?.node?.id ?? ''
              );
              if (!pid) return item;
              try {
                const raw = await $fetch<unknown>(endpoint(`product/${pid}`));
                const data = unwrapYardsaleResponse(raw) as {
                  product?: Record<string, unknown>;
                } | null;
                const p = data?.product ?? (data as Record<string, unknown> | null);
                if (!p || typeof p !== 'object') return item;
                const qty = item.quantity || 1;
                const line = yardsaleProductRowToCartItem(p, qty, resolveMediaUrl);
                return line ? { ...line, quantity: qty } : item;
              } catch {
                return item;
              }
            })
          );
          updateCart(next as CartItem[]);
          return true;
        }
        const raw = await $fetch<unknown>(endpoint('refresh-cart-stock'), {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: {},
        });
        const data = unwrapYardsaleResponse(raw) as { items?: unknown[] } | null;
        if (data?.items && Array.isArray(data.items)) {
          const mapped = serverCartRowsToCartItems(
            data.items as Parameters<typeof serverCartRowsToCartItems>[0],
            resolveMediaUrl
          ) as CartItem[];
          updateCart(mapped);
        }
        return true;
      }

      const res = await $fetch<{ ok: boolean; lines: RefreshLine[] }>('/api/refresh-cart-stock', {
        method: 'POST',
        body: { items },
      });
      if (res?.ok === false) {
        console.warn('[useCart] refresh-cart-stock returned ok:false');
        return false;
      }
      if (!res?.lines?.length) return true;
      const next = cart.value.map((item) => {
        const parentId = Number(item.product?.node?.databaseId ?? item.product?.node?.id ?? 0);
        const rawVid = item.variation?.node?.databaseId ?? item.variation?.node?.id;
        const variationId =
          rawVid != null && rawVid !== '' ? Number(rawVid) : undefined;
        const isVariation = item.variation?.node != null;
        const pid = isVariation ? parentId : Number(item.product?.node?.databaseId ?? item.product?.node?.id ?? 0);
        const vid =
          isVariation && variationId !== undefined && !Number.isNaN(variationId) ? variationId : undefined;
        const line = res.lines.find(
          (l) => l.product_id === pid && Number(l.variation_id ?? 0) === Number(vid ?? 0)
        );
        if (!line) return item;
        const clone = JSON.parse(JSON.stringify(item)) as CartItem;
        const statusToken = wcStatusToCartStockToken(line.stockStatus);
        const sq =
          line.stockQuantity !== null && line.stockQuantity !== undefined
            ? Number(line.stockQuantity)
            : null;
        if (isVariation && clone.variation?.node) {
          if (sq !== null) clone.variation.node.stockQuantity = sq;
          clone.variation.node.stockStatus = statusToken;
        }
        if (!isVariation && clone.product?.node) {
          if (sq !== null) clone.product.node.stockQuantity = sq;
          clone.product.node.stockStatus = statusToken;
        }
        return clone;
      });
      updateCart(next);
      return true;
    } catch (e) {
      console.warn('[useCart] refreshCartStockFromServer failed', e);
      return false;
    }
  };

  const removeItem = async (key: string) => {
    const item = cart.value.find(i => i.key === key);
    if (!item) return;
    
    try {
      if (hasRemoteApi) {
        if (!user.value?.token) {
          updateCart(cart.value.filter((i) => i.key !== key));
          return;
        }
        const nextItems = cart.value
          .filter((i) => i.key !== key)
          .map((i) => ({
            product_id: String(i.product?.node?.databaseId ?? i.product?.node?.id ?? ''),
            quantity: i.quantity || 1,
          }))
          .filter((x) => x.product_id);
        const raw = await $fetch<unknown>(endpoint('cart/update'), {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: { items: nextItems },
        });
        const data = unwrapYardsaleResponse(raw) as { items?: unknown[] } | null;
        const mapped = serverCartRowsToCartItems(
          data?.items as Parameters<typeof serverCartRowsToCartItems>[0],
          resolveMediaUrl
        ) as CartItem[];
        updateCart(mapped);
        return;
      }

      await $fetch('/api/cart/update', { method: 'POST', body: { items: [{ key, quantity: 0 }] } });
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
    getCartItemsForStockApi,
    refreshCartStockFromServer,
  };
};
