// server/api/product.get.ts
// Direct database access - no PHP/WordPress

import { getDbPool, fixImageUrl } from '~/server/utils/db';

export default cachedEventHandler(
  async (event) => {
    try {
      const pool = getDbPool();
      
      // Get query parameters
      const query = getQuery(event);
      const slug = query.slug as string | undefined;
      const sku = query.sku as string | undefined;
      
      if (!slug && !sku) {
        throw createError({
          statusCode: 400,
          message: 'slug or sku is required',
        });
      }
      
      let productId: number | null = null;
      
      // Try to find product by slug first
      if (slug) {
        const [rows] = await pool.execute(
          "SELECT ID FROM wp_posts WHERE post_type = 'product' AND post_name = ? LIMIT 1",
          [slug]
        ) as any[];
        if (rows && rows.length > 0) {
          productId = rows[0].ID;
        }
      }
      
      // If not found by slug, try by SKU
      if (!productId && sku) {
        const [rows] = await pool.execute(
          "SELECT post_id FROM wp_postmeta WHERE meta_key = '_sku' AND meta_value = ? LIMIT 1",
          [sku]
        ) as any[];
        if (rows && rows.length > 0) {
          productId = rows[0].post_id;
        }
      }
      
      if (!productId) {
        return { product: null };
      }
      
      // Get product post data
      const [postRows] = await pool.execute(
        'SELECT ID, post_title, post_name, post_content, post_status FROM wp_posts WHERE ID = ?',
        [productId]
      ) as any[];
      
      if (!postRows || postRows.length === 0) {
        return { product: null };
      }
      
      const post = postRows[0];
      
      // Get product meta
      const [metaRows] = await pool.execute(
        'SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id = ?',
        [productId]
      ) as any[];
      
      const meta: Record<string, any> = {};
      for (const row of metaRows) {
        meta[row.meta_key] = row.meta_value;
      }
      
      // Check if simple product
      if (meta['_product_type'] !== 'simple') {
        return { product: null };
      }
      
      // Get product data
      const productSku = meta['_sku'] || '';
      const productName = post.post_title;
      const productDescription = post.post_content;
      const productStatus = post.post_status;
      
      // Get prices
      let regularPriceRaw = parseFloat(meta['_regular_price'] || '0');
      const salePriceRaw = parseFloat(meta['_sale_price'] || '0');
      
      if (regularPriceRaw <= 0) {
        regularPriceRaw = parseFloat(meta['_price'] || '0');
      }
      
      // Format prices
      const regularPrice = regularPriceRaw > 0
        ? `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${regularPriceRaw.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span>`
        : '';
      
      const salePrice = salePriceRaw > 0
        ? `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${salePriceRaw.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span>`
        : null;
      
      // Get stock
      const stockQuantity = meta['_stock'] ? parseInt(meta['_stock']) : null;
      let stockStatus = meta['_stock_status'] || 'instock';
      
      // If product status is cancelled or trash, show as in stock
      if (productStatus === 'cancelled' || productStatus === 'trash') {
        stockStatus = 'instock';
      }
      
      // Get product image
      let imageUrl: string | null = null;
      const imageId = meta['_thumbnail_id'] ? parseInt(meta['_thumbnail_id']) : 0;
      if (imageId > 0) {
        const [imgRows] = await pool.execute(
          'SELECT guid FROM wp_posts WHERE ID = ?',
          [imageId]
        ) as any[];
        if (imgRows && imgRows.length > 0) {
          imageUrl = fixImageUrl(imgRows[0].guid);
        }
      }
      
      // Get gallery images
      const galleryImages: any[] = [];
      const galleryIdsStr = meta['_product_image_gallery'] || '';
      if (galleryIdsStr) {
        const galleryIds = galleryIdsStr.split(',').map(id => parseInt(id.trim())).filter(id => id > 0);
        for (const galleryId of galleryIds) {
          const [galleryRows] = await pool.execute(
            'SELECT guid FROM wp_posts WHERE ID = ?',
            [galleryId]
          ) as any[];
          if (galleryRows && galleryRows.length > 0) {
            const galleryUrl = fixImageUrl(galleryRows[0].guid);
            if (galleryUrl) {
              galleryImages.push({ sourceUrl: galleryUrl });
            }
          }
        }
      }
      
      // Get PA Style attribute
      const [styleRows] = await pool.execute(
        `SELECT t.name 
         FROM wp_terms t
         INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
         INNER JOIN wp_term_relationships tr ON tt.term_taxonomy_id = tr.term_taxonomy_id
         WHERE tr.object_id = ? AND tt.taxonomy = 'pa_style'`,
        [productId]
      ) as any[];
      
      const paStyle = (styleRows || []).map((row: any) => ({ name: row.name }));
      
      // Get PA Color attribute
      const [colorRows] = await pool.execute(
        `SELECT t.name 
         FROM wp_terms t
         INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
         INNER JOIN wp_term_relationships tr ON tt.term_taxonomy_id = tr.term_taxonomy_id
         WHERE tr.object_id = ? AND tt.taxonomy = 'pa_color'`,
        [productId]
      ) as any[];
      
      const paColor = (colorRows || []).map((row: any) => ({ name: row.name }));
      
      // Get related products (simplified - from same categories)
      const relatedProducts: any[] = [];
      const [relatedRows] = await pool.execute(
        `SELECT DISTINCT p.ID, p.post_title, p.post_name
         FROM wp_posts p
         INNER JOIN wp_term_relationships tr ON p.ID = tr.object_id
         INNER JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
         INNER JOIN wp_term_relationships tr2 ON tt.term_id = (
           SELECT tt2.term_id FROM wp_term_taxonomy tt2
           INNER JOIN wp_term_relationships tr3 ON tt2.term_taxonomy_id = tr3.term_taxonomy_id
           WHERE tr3.object_id = ? AND tt2.taxonomy = 'product_cat'
           LIMIT 1
         )
         WHERE p.post_type = 'product'
         AND p.post_status = 'publish'
         AND p.ID != ?
         AND EXISTS (
           SELECT 1 FROM wp_postmeta pm 
           WHERE pm.post_id = p.ID 
           AND pm.meta_key = '_product_type' 
           AND pm.meta_value = 'simple'
         )
         LIMIT 10`,
        [productId, productId]
      ) as any[];
      
      for (const relatedRow of relatedRows) {
        const relatedId = relatedRow.ID;
        
        // Get related product meta
        const [relatedMetaRows] = await pool.execute(
          'SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id = ?',
          [relatedId]
        ) as any[];
        
        const relatedMeta: Record<string, any> = {};
        for (const row of relatedMetaRows) {
          relatedMeta[row.meta_key] = row.meta_value;
        }
        
        const relatedSku = relatedMeta['_sku'] || '';
        const relatedRegularPrice = relatedMeta['_regular_price'] || '';
        const relatedSalePrice = relatedMeta['_sale_price'] || '';
        
        let relatedImageUrl: string | null = null;
        const relatedImageId = relatedMeta['_thumbnail_id'] ? parseInt(relatedMeta['_thumbnail_id']) : 0;
        if (relatedImageId > 0) {
          const [relatedImgRows] = await pool.execute(
            'SELECT guid FROM wp_posts WHERE ID = ?',
            [relatedImageId]
          ) as any[];
          if (relatedImgRows && relatedImgRows.length > 0) {
            relatedImageUrl = fixImageUrl(relatedImgRows[0].guid);
          }
        }
        
        const relatedGalleryImages: any[] = [];
        const relatedGalleryIdsStr = relatedMeta['_product_image_gallery'] || '';
        if (relatedGalleryIdsStr) {
          const relatedGalleryIds = relatedGalleryIdsStr.split(',').map(id => parseInt(id.trim())).filter(id => id > 0);
          for (const galleryId of relatedGalleryIds) {
            const [galleryRows] = await pool.execute(
              'SELECT guid FROM wp_posts WHERE ID = ?',
              [galleryId]
            ) as any[];
            if (galleryRows && galleryRows.length > 0) {
              const galleryUrl = fixImageUrl(galleryRows[0].guid);
              if (galleryUrl) {
                relatedGalleryImages.push({ sourceUrl: galleryUrl });
              }
            }
          }
        }
        
        const [relatedStyleRows] = await pool.execute(
          `SELECT t.name 
           FROM wp_terms t
           INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
           INNER JOIN wp_term_relationships tr ON tt.term_taxonomy_id = tr.term_taxonomy_id
           WHERE tr.object_id = ? AND tt.taxonomy = 'pa_style'`,
          [relatedId]
        ) as any[];
        
        const relatedPaStyle = (relatedStyleRows || []).map((row: any) => ({ name: row.name }));
        
        relatedProducts.push({
          sku: relatedSku,
          slug: relatedRow.post_name,
          name: relatedRow.post_title,
          regularPrice: relatedRegularPrice,
          salePrice: relatedSalePrice || null,
          allPaStyle: { nodes: relatedPaStyle },
          image: relatedImageUrl ? { sourceUrl: relatedImageUrl } : null,
          galleryImages: { nodes: relatedGalleryImages },
        });
      }
      
      return {
        product: {
          databaseId: productId,
          sku: productSku,
          slug: post.post_name,
          name: productName,
          description: productDescription,
          regularPrice,
          salePrice,
          stockQuantity,
          stockStatus: stockStatus.toUpperCase(),
          status: productStatus,
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
      throw createError({
        statusCode: error.statusCode || 500,
        message: error.message || 'Failed to fetch product',
      });
    }
  },
  {
    maxAge: 1,
    swr: false,
    getKey: event => event.req.url!,
  }
);
