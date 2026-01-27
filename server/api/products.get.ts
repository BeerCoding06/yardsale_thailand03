// server/api/products.get.ts
// Direct database access - no PHP/WordPress

import { getDbPool, fixImageUrl } from '../utils/db';

export default cachedEventHandler(
  async (event) => {
    try {
      const pool = getDbPool();
      
      // If database is not available, return empty data
      if (!pool) {
        console.warn('[products] Database not available, returning empty data');
        return {
          products: {
            nodes: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        };
      }
      
      // Get query parameters
      const query = getQuery(event);
      const after = query.after as string | undefined;
      const search = query.search as string | undefined;
      const category = query.category as string | undefined;
      const order = (query.order as string) || 'DESC';
      const field = (query.field as string) || 'DATE';
      const perPage = 21;
      
      // Parse page from cursor
      let page = 1;
      if (after) {
        try {
          const decoded = Buffer.from(after, 'base64').toString('utf-8');
          const match = decoded.match(/page:(\d+)/);
          if (match) {
            page = parseInt(match[1]);
          }
        } catch (e) {
          // Invalid cursor, use page 1
        }
      }
      
      // Map orderby to database fields
      const orderbyMap: Record<string, string> = {
        'DATE': 'p.post_date',
        'TITLE': 'p.post_title',
        'PRICE': 'price_meta.meta_value',
        'RATING': 'p.post_date',
        'POPULARITY': 'p.post_date',
      };
      const dbOrderby = orderbyMap[field] || 'p.post_date';
      const dbOrder = order === 'ASC' ? 'ASC' : 'DESC';
      
      // Build WHERE conditions
      // Note: Removed stock_status filter to show all published products
      const whereConditions: string[] = [
        "p.post_type = 'product'",
        "p.post_status = 'publish'"
      ];
      
      // Add search condition
      if (search) {
        whereConditions.push(`(p.post_title LIKE ? OR p.post_content LIKE ?)`);
      }
      
      // Add category filter
      let categoryJoin = '';
      let categoryId: number | null = null;
      if (category) {
        const [catRows] = await pool.execute(
          `SELECT term_id FROM wp_terms t 
           INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id 
           WHERE tt.taxonomy = 'product_cat' 
           AND (t.name = ? OR t.slug = ?) 
           LIMIT 1`,
          [category, category.toLowerCase().replace(/\s+/g, '-')]
        ) as any[];
        
        if (catRows && catRows.length > 0) {
          categoryId = catRows[0].term_id;
          categoryJoin = `INNER JOIN wp_term_relationships tr ON p.ID = tr.object_id
            INNER JOIN wp_term_taxonomy tt_cat ON tr.term_taxonomy_id = tt_cat.term_taxonomy_id
            AND tt_cat.term_id = ?
            AND tt_cat.taxonomy = 'product_cat'`;
        }
      }
      
      // Handle price ordering
      let priceJoin = '';
      if (dbOrderby === 'price_meta.meta_value') {
        priceJoin = `LEFT JOIN wp_postmeta price_meta ON p.ID = price_meta.post_id AND price_meta.meta_key = '_price'`;
      }
      
      // Build query parameters
      const queryParams: any[] = [];
      if (search) {
        queryParams.push(`%${search}%`, `%${search}%`);
      }
      if (categoryId !== null) {
        queryParams.push(categoryId);
      }
      
      // Get total count
      let totalCount = 0;
      let totalPages = 0;
      try {
        let countSql = `SELECT COUNT(DISTINCT p.ID) as total
          FROM wp_posts p
          ${categoryJoin}
          WHERE ${whereConditions.join(' AND ')}`;
        
        const [countRows] = await pool.execute(countSql, queryParams) as any[];
        totalCount = countRows[0]?.total || 0;
        totalPages = Math.ceil(totalCount / perPage);
        console.log('[products] Total products found:', totalCount);
      } catch (dbError: any) {
        console.error('[products] Database count query error:', dbError);
        return {
          products: {
            nodes: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        };
      }
      
      // Build main query
      const offset = (page - 1) * perPage;
      let sql = `SELECT DISTINCT p.ID, p.post_title, p.post_name, p.post_date
        FROM wp_posts p
        ${priceJoin}
        ${categoryJoin}
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${dbOrderby} ${dbOrder}
        LIMIT ? OFFSET ?`;
      
      console.log('[products] Query:', sql);
      console.log('[products] Query params:', queryParams);
      
      queryParams.push(perPage, offset);
      let rows: any[] = [];
      try {
        const [result] = await pool.execute(sql, queryParams) as any[];
        rows = result || [];
        console.log('[products] Found products:', rows.length);
      } catch (dbError: any) {
        console.error('[products] Database query error:', dbError);
        console.error('[products] SQL:', sql);
        console.error('[products] Params:', queryParams);
        return {
          products: {
            nodes: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        };
      }
      
      // Fetch product details
      const products: any[] = [];
      
      for (const post of rows) {
        const productId = post.ID;
        
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
          continue;
        }
        
        // Get SKU
        const sku = meta['_sku'] || '';
        
        // Get prices
        let regularPriceRaw = parseFloat(meta['_regular_price'] || '0');
        const salePriceRaw = parseFloat(meta['_sale_price'] || '0');
        
        if (regularPriceRaw <= 0) {
          regularPriceRaw = parseFloat(meta['_price'] || '0');
        }
        
        // Format prices
        const regularPrice = regularPriceRaw > 0
          ? `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(regularPriceRaw).toLocaleString()}</span>`
          : '';
        
        const salePrice = salePriceRaw > 0
          ? `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(salePriceRaw).toLocaleString()}</span>`
          : '';
        
        // Get stock
        const stockQuantity = meta['_stock'] ? parseInt(meta['_stock']) : null;
        const stockStatus = meta['_stock_status'] || 'instock';
        
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
        
        products.push({
          sku,
          slug: post.post_name,
          name: post.post_title,
          regularPrice,
          salePrice,
          stockQuantity,
          stockStatus: stockStatus.toUpperCase(),
          allPaStyle: { nodes: paStyle },
          image: imageUrl ? { sourceUrl: imageUrl } : null,
          galleryImages: { nodes: galleryImages },
        });
      }
      
      // Calculate pagination
      const hasNextPage = page < totalPages;
      const endCursor = hasNextPage ? Buffer.from(`page:${page + 1}`).toString('base64') : null;
      
      return {
        products: {
          nodes: products,
          pageInfo: {
            hasNextPage,
            endCursor,
          },
        },
      };
    } catch (error: any) {
      console.error('[products] Error:', error);
      // Return empty data instead of throwing error to keep the app working
      return {
        products: {
          nodes: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      };
    }
  },
  {
    maxAge: 1,
    swr: false,
    getKey: event => event.req.url!,
  }
);
