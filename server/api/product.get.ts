// server/api/product.get.ts
// Fetch single product from WordPress REST API

import * as wpUtils from '../utils/wp';

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      
      const slug = query.slug as string | undefined;
      const sku = query.sku as string | undefined;
      
      if (!slug && !sku) {
        return { product: null };
      }
      
      let productId: number | null = null;
      let product: any = null;
      
      // Try to find product by slug first
      if (slug) {
        try {
          const apiUrl = wpUtils.buildWpApiUrl('wp/v2/product', {
            slug: slug,
            per_page: 1,
            status: 'publish',
            _embed: '1'
          });
          
          const headers = wpUtils.getWpApiHeaders(true, false);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(10000),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              product = data[0];
              productId = product.id;
            }
          }
        } catch (e) {
          console.warn('[product] Error fetching by slug:', e);
        }
      }
      
      // If not found by slug, try by SKU using WooCommerce API
      if (!productId && sku) {
        try {
          const wcHeaders = wpUtils.getWpApiHeaders(false, true);
          if (wcHeaders['Authorization']) {
            const wcUrl = wpUtils.buildWpApiUrl('wc/v3/products', {
              sku: sku,
              per_page: 1
            });
            
            const wcResponse = await fetch(wcUrl, {
              method: 'GET',
              headers: wcHeaders,
              signal: AbortSignal.timeout(10000),
            });
            
            if (wcResponse.ok) {
              const wcData = await wcResponse.json();
              if (Array.isArray(wcData) && wcData.length > 0) {
                productId = wcData[0].id;
                // Fetch full product from WordPress REST API
                const wpUrl = wpUtils.buildWpApiUrl(`wp/v2/product/${productId}`, {
                  _embed: '1'
                });
                const wpHeaders = wpUtils.getWpApiHeaders(true, false);
                const wpResponse = await fetch(wpUrl, {
                  method: 'GET',
                  headers: wpHeaders,
                  signal: AbortSignal.timeout(10000),
                });
                if (wpResponse.ok) {
                  product = await wpResponse.json();
                }
              }
            }
          }
        } catch (e) {
          console.warn('[product] Error fetching by SKU:', e);
        }
      }
      
      if (!product || !productId) {
        return { product: null };
      }
      
      // Get WooCommerce product data for price, SKU, stock
      let wcProduct: any = null;
      try {
        const wcHeaders = wpUtils.getWpApiHeaders(false, true);
        if (wcHeaders['Authorization']) {
          const wcUrl = wpUtils.buildWpApiUrl(`wc/v3/products/${productId}`);
          console.log(`[product] Fetching WooCommerce data for product ${productId}:`, wcUrl);
          
          const wcResponse = await fetch(wcUrl, {
            method: 'GET',
            headers: wcHeaders,
            signal: AbortSignal.timeout(10000), // Increase timeout to 10 seconds
          });
          
          console.log(`[product] WooCommerce API response for product ${productId}:`, wcResponse.status);
          
          if (wcResponse.ok) {
            wcProduct = await wcResponse.json();
            console.log(`[product] WooCommerce product data for ${productId}:`, {
              hasRegularPrice: !!wcProduct.regular_price,
              hasSalePrice: !!wcProduct.sale_price,
              hasSku: !!wcProduct.sku,
              hasStockQuantity: wcProduct.stock_quantity !== null && wcProduct.stock_quantity !== undefined,
              stockStatus: wcProduct.stock_status,
            });
          } else {
            const errorText = await wcResponse.text().catch(() => '');
            console.warn(`[product] WooCommerce API error for product ${productId}:`, wcResponse.status, errorText.substring(0, 200));
          }
        } else {
          console.warn(`[product] WooCommerce API credentials not configured for product ${productId}`);
        }
      } catch (e) {
        console.error(`[product] Error fetching WooCommerce data for product ${productId}:`, e);
      }
      
      // Get featured image
      let imageUrl: string | null = null;
      if (product._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
        imageUrl = product._embedded['wp:featuredmedia'][0].source_url;
      } else if (product.featured_media) {
        try {
          const mediaUrl = wpUtils.buildWpApiUrl(`wp/v2/media/${product.featured_media}`);
          const mediaResponse = await fetch(mediaUrl, {
            method: 'GET',
            headers: wpUtils.getWpApiHeaders(true, false),
            signal: AbortSignal.timeout(5000),
          });
          if (mediaResponse.ok) {
            const media = await mediaResponse.json();
            imageUrl = media.source_url || null;
          }
        } catch (e) {
          console.warn('[product] Error fetching media:', e);
        }
      }
      
      // Get gallery images (WordPress REST API doesn't provide gallery directly)
      // We'll use featured image as gallery for now
      const galleryImages: any[] = [];
      if (imageUrl) {
        galleryImages.push({ sourceUrl: imageUrl });
      }
      
      // Get prices from WooCommerce
      let regularPrice = '';
      let salePrice: string | null = null;
      let productSku = product.slug || `product-${productId}`;
      let stockQuantity: number | null = null;
      let stockStatus = 'IN_STOCK';
      
      if (wcProduct) {
        if (wcProduct.regular_price && wcProduct.regular_price !== '') {
          const price = parseFloat(wcProduct.regular_price);
          if (!isNaN(price) && price > 0) {
            regularPrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
          }
        }
        if (wcProduct.sale_price && wcProduct.sale_price !== '') {
          const price = parseFloat(wcProduct.sale_price);
          if (!isNaN(price) && price > 0) {
            salePrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
          }
        }
        if (wcProduct.sku) {
          productSku = wcProduct.sku;
        }
        if (wcProduct.stock_quantity !== null && wcProduct.stock_quantity !== undefined) {
          stockQuantity = parseInt(wcProduct.stock_quantity);
        }
        if (wcProduct.stock_status) {
          stockStatus = wcProduct.stock_status.toUpperCase();
        }
      } else {
        console.warn(`[product] No WooCommerce data available for product ${productId}, prices and stock will be empty`);
      }
      
      // Get PA Style and PA Color attributes (if available)
      const paStyle: any[] = [];
      const paColor: any[] = [];
      
      // Get related products (from same categories)
      const relatedProducts: any[] = [];
      try {
        const productCats = product.product_cat || [];
        if (productCats.length > 0) {
          const relatedUrl = wpUtils.buildWpApiUrl('wp/v2/product', {
            product_cat: productCats[0],
            per_page: 10,
            exclude: productId,
            status: 'publish',
            _embed: '1'
          });
          
          const relatedResponse = await fetch(relatedUrl, {
            method: 'GET',
            headers: wpUtils.getWpApiHeaders(true, false),
            signal: AbortSignal.timeout(10000),
          });
          
          if (relatedResponse.ok) {
            const relatedData = await relatedResponse.json();
            for (const related of Array.isArray(relatedData) ? relatedData : []) {
              let relatedImageUrl: string | null = null;
              if (related._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
                relatedImageUrl = related._embedded['wp:featuredmedia'][0].source_url;
              }
              
              // Get WooCommerce data for related product
              let relatedRegularPrice = '';
              let relatedSalePrice: string | null = null;
              let relatedSku = related.slug || `product-${related.id}`;
              
              try {
                const wcHeaders = wpUtils.getWpApiHeaders(false, true);
                if (wcHeaders['Authorization']) {
                  const wcUrl = wpUtils.buildWpApiUrl(`wc/v3/products/${related.id}`);
                  const wcResponse = await fetch(wcUrl, {
                    method: 'GET',
                    headers: wcHeaders,
                    signal: AbortSignal.timeout(3000),
                  });
                  
                  if (wcResponse.ok) {
                    const wcRelated = await wcResponse.json();
                    if (wcRelated.regular_price) {
                      relatedRegularPrice = wcRelated.regular_price;
                    }
                    if (wcRelated.sale_price) {
                      relatedSalePrice = wcRelated.sale_price;
                    }
                    if (wcRelated.sku) {
                      relatedSku = wcRelated.sku;
                    }
                  }
                }
              } catch (e) {
                // Ignore errors for related products
              }
              
              relatedProducts.push({
                sku: relatedSku,
                slug: related.slug,
                name: related.title?.rendered || related.title || '',
                regularPrice: relatedRegularPrice,
                salePrice: relatedSalePrice,
                allPaStyle: { nodes: [] },
                image: relatedImageUrl ? { sourceUrl: relatedImageUrl } : null,
                galleryImages: { nodes: relatedImageUrl ? [{ sourceUrl: relatedImageUrl }] : [] },
              });
            }
          }
        }
      } catch (e) {
        console.warn('[product] Error fetching related products:', e);
      }
      
      return {
        product: {
          databaseId: productId,
          sku: productSku,
          slug: product.slug,
          name: product.title?.rendered || product.title || '',
          description: product.content?.rendered || product.content || '',
          regularPrice,
          salePrice,
          stockQuantity,
          stockStatus,
          status: product.status,
          image: imageUrl ? { sourceUrl: imageUrl } : null,
          galleryImages: { nodes: galleryImages },
          allPaColor: { nodes: paColor },
          allPaStyle: { nodes: paStyle },
          related: { nodes: relatedProducts },
          variations: { nodes: [] },
        }
      };
    } catch (error: any) {
      console.error('[product] Error:', error);
      return { product: null };
    }
  },
  {
    maxAge: 1,
    swr: false,
    getKey: event => event.req.url!,
  }
);
