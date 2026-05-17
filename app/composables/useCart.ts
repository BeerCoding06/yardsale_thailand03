// app/composables/useCart.ts
import { push } from 'notivue';
import { isCartLineSalableBySnapshot, clampCartQuantitiesToStock } from '~/utils/cart-line-salable';
import { wcStatusToCartStockToken } from '~/utils/stock-status-format';
import { serverCartRowsToCartItems, yardsaleProductRowToCartItem } from '~/utils/yardsaleCart';
import {
  CART_LOCAL_STORAGE_KEY,
  parseStoredCart,
  stringifyStoredCart,
} from '~/utils/cart-session-storage';
import { messageFromYardsaleBody, yardsaleBodyIsFailure } from '~/utils/cmsApiEndpoint';
import type { CartItem } from '~~/shared/types';

/** โหลดตะกร้าจาก localStorage แค่ครั้งเดียวต่อแท็บ — กันหลายคอมโพเนนต์เรียก useCart() แล้ว onMounted ซ้ำ */
let cartLocalStorageHydrated = false;

export const useCart = () => {
  const { t } = useI18n();
  const {
    hasRemoteApi,
    fetchYardsale,
    resolveMediaUrl,
    isStorefrontPublishedProduct,
  } = useStorefrontCatalog();
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

  /** อ่าน snapshot สต็อกจากบรรทัดตะกร้า — แปลงเป็นตัวเลขเท่านั้นเมื่อ parse ได้ */
  const itemStockSnapshot = (item: CartItem) => {
    const raw =
      item.variation?.node?.stockQuantity ?? item.product?.node?.stockQuantity ?? null;
    const stockStatus =
      item.variation?.node?.stockStatus ?? item.product?.node?.stockStatus;
    let stockQuantity: number | null = null;
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) stockQuantity = n;
    }
    return { stockStatus, stockQuantity };
  };

  const isCartLineArg = (x: unknown): x is CartItem =>
    x != null &&
    typeof x === 'object' &&
    !Array.isArray(x) &&
    typeof (x as { key?: unknown }).key === 'string' &&
    (x as CartItem).product?.node != null;

  const resolveCartItem = (productIdOrItem: number | string | CartItem): CartItem | undefined => {
    if (isCartLineArg(productIdOrItem)) {
      return cart.value.find((i) => i.key === productIdOrItem.key) ?? productIdOrItem;
    }
    return findItem(productIdOrItem as number | string);
  };

  const canIncreaseCartQuantity = (item: CartItem): boolean => {
    const { stockStatus, stockQuantity } = itemStockSnapshot(item);
    const next = (item.quantity || 1) + 1;
    return isCartLineSalableBySnapshot(stockStatus, stockQuantity, next);
  };

  const updateCart = (next: CartItem[]) => {
    const clamped = clampCartQuantitiesToStock(next) as CartItem[];
    cart.value = clamped;
    if (import.meta.client) {
      localStorage.setItem(CART_LOCAL_STORAGE_KEY, stringifyStoredCart(clamped));
    }
  };

  /** parentProductId = parent product id เมื่อ productId คือ variation id */
  const handleAddToCart = async (productId: number | string, parentProductId?: number) => {
    try {
      addToCartButtonStatus.value = 'loading';

      if (hasRemoteApi) {
        const product_id = String(productId);
        if (!isAuthenticated.value || !user.value?.token) {
          const data = (await fetchYardsale(`product/${product_id}`)) as {
            product?: Record<string, unknown>;
          } | null;
          if (yardsaleBodyIsFailure(data)) {
            push.error(messageFromYardsaleBody(data, t('cart.add_error')));
            addToCartButtonStatus.value = 'add';
            return;
          }
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

        const data = (await fetchYardsale('cart/add', {
          method: 'POST',
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          body: { product_id, quantity: 1 },
        })) as { items?: unknown[] } | null;
        if (yardsaleBodyIsFailure(data)) {
          push.error(messageFromYardsaleBody(data, t('cart.add_error')));
          addToCartButtonStatus.value = 'add';
          return;
        }
        if (!Array.isArray(data?.items)) {
          push.error(t('cart.add_error'));
          addToCartButtonStatus.value = 'add';
          return;
        }
        const rows = data.items;
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
          const data2 = (await fetchYardsale('cart/update', {
            method: 'POST',
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json',
            },
            body: { items: mergedPayload },
          })) as { items?: unknown[] } | null;
          if (yardsaleBodyIsFailure(data2)) {
            push.error(messageFromYardsaleBody(data2, t('cart.update_error')));
            addToCartButtonStatus.value = 'add';
            return;
          }
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


      const res = await $fetch<AddToCartResponse>('/api/cart/add', {
        method: 'POST',
        body: {
          productId,
          ...(parentProductId != null &&
            Number(parentProductId) > 0 && { parentProductId: Number(parentProductId) }),
        },
      });


      if (!res || !res.addToCart || !res.addToCart.cartItem) {
        console.error('[useCart] Invalid response structure:', res);
        throw new Error('Invalid response from add to cart API');
      }

      const incoming = res.addToCart.cartItem;
      const idx = cart.value.findIndex((i) => i.key === incoming.key);

      if (idx > -1) {
        const prev = cart.value[idx];
        /**
         * ยอดจาก API เป็นจำนวนรวมของบรรทัดนั้นหลังบันทึกแล้ว — ห้ามบวกซ้ำกับ prev
         * (ถ้าเคยทำ prev + incoming เมื่อ incoming เป็นยอดรวม จะเกิด 1+2=3, 3+3=6...)
         */
        const lineTotal =
          incoming.quantity != null && incoming.quantity !== ''
            ? Math.max(1, Number(incoming.quantity))
            : prev.quantity + 1;
        const merged = {
          ...prev,
          ...incoming,
          quantity: Number.isFinite(lineTotal) ? lineTotal : prev.quantity + 1,
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
    
    const { stockQuantity, stockStatus } = itemStockSnapshot(item);

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
        const data = (await fetchYardsale('cart/update', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: { items: nextItems },
        })) as { items?: unknown[] } | null;
        if (yardsaleBodyIsFailure(data)) {
          push.error(messageFromYardsaleBody(data, t('cart.update_error')));
          return;
        }
        if (!Array.isArray(data?.items)) {
          push.error(t('cart.update_error'));
          return;
        }
        const mapped = serverCartRowsToCartItems(
          data.items as Parameters<typeof serverCartRowsToCartItems>[0],
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

  const increment = (productIdOrItem: number | string | CartItem) => {
    const item = resolveCartItem(productIdOrItem);
    if (!item) {
      if (isCartLineArg(productIdOrItem)) return;
      handleAddToCart(productIdOrItem as number | string);
      return;
    }
    if (!canIncreaseCartQuantity(item)) {
      const { stockStatus } = itemStockSnapshot(item);
      const norm = (stockStatus ?? '').toString().toUpperCase().replace(/\s/g, '_');
      if (norm === 'OUT_OF_STOCK' || norm === 'OUTOFSTOCK') {
        push.error(t('cart.out_of_stock'));
      } else {
        push.error(t('cart.insufficient_stock'));
      }
      return;
    }
    changeQty(item.key, item.quantity + 1);
  };

  const decrement = (productIdOrItem: number | string | CartItem) => {
    const item = resolveCartItem(productIdOrItem);
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
          const next: CartItem[] = [];
          for (const item of cart.value) {
            const pid = String(
              item.product?.node?.databaseId ?? item.product?.node?.id ?? ''
            );
            if (!pid) {
              next.push(item);
              continue;
            }
            try {
              const data = (await fetchYardsale(`product/${pid}`)) as {
                product?: Record<string, unknown>;
              } | null;
              if (yardsaleBodyIsFailure(data)) {
                next.push(item);
                continue;
              }
              const p = data?.product ?? (data as Record<string, unknown> | null);
              if (!p || typeof p !== 'object') {
                next.push(item);
                continue;
              }
              const stock = Number((p as { stock?: unknown }).stock ?? 0);
              const wantQty = item.quantity || 1;
              if (stock < 1) continue;
              const cappedQty = Math.min(wantQty, stock);
              const line = yardsaleProductRowToCartItem(p, cappedQty, resolveMediaUrl);
              if (line) next.push({ ...line, quantity: cappedQty });
              else next.push(item);
            } catch {
              next.push(item);
            }
          }
          updateCart(next);
          return true;
        }
        const data = (await fetchYardsale('refresh-cart-stock', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: {},
        })) as { items?: unknown[] } | null;
        if (yardsaleBodyIsFailure(data)) {
          return false;
        }
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
        const data = (await fetchYardsale('cart/update', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: { items: nextItems },
        })) as { items?: unknown[] } | null;
        if (yardsaleBodyIsFailure(data)) {
          push.error(messageFromYardsaleBody(data, t('cart.remove_error')));
          return;
        }
        if (!Array.isArray(data?.items)) {
          push.error(t('cart.remove_error'));
          return;
        }
        const mapped = serverCartRowsToCartItems(
          data.items as Parameters<typeof serverCartRowsToCartItems>[0],
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
    if (cartLocalStorageHydrated) return;
    cartLocalStorageHydrated = true;
    const stored = localStorage.getItem(CART_LOCAL_STORAGE_KEY);
    const { items: parsedItems, expired } = parseStoredCart(stored);
    if (expired) {
      localStorage.removeItem(CART_LOCAL_STORAGE_KEY);
      push.info(t('cart.session_expired'));
      updateCart([]);
      return;
    }
    const validItems = parsedItems as CartItem[];
    if (validItems.length > 0) {
      updateCart(validItems);
    }
  });

  return {
    cart,
    addToCartButtonStatus,
    handleAddToCart,
    increment,
    decrement,
    canIncreaseCartQuantity,
    removeItem,
    getCartItemsForStockApi,
    refreshCartStockFromServer,
  };
};
