// server/api/categories.get.ts
// Direct database access - no PHP/WordPress

import { getDbPool, fixImageUrl } from '~/server/utils/db';

export default cachedEventHandler(
  async (event) => {
    try {
      const pool = getDbPool();
      
      // Get query parameters
      const query = getQuery(event);
      const parent = parseInt(query.parent as string || '0');
      const hideEmpty = query.hide_empty !== 'false';
      const orderby = (query.orderby as string) || 'name';
      const order = (query.order as string) || 'ASC';
      
      // Map orderby to database fields
      const orderbyMap: Record<string, string> = {
        'name': 't.name',
        'count': 'tt.count',
        'id': 't.term_id',
        'slug': 't.slug',
        'term_group': 't.term_group',
        'none': 't.term_id',
      };
      const dbOrderby = orderbyMap[orderby] || 't.name';
      const dbOrder = order === 'DESC' ? 'DESC' : 'ASC';
      
      // Build query
      const [rows] = await pool.execute(
        `SELECT t.term_id, t.name, t.slug, tt.description, tt.parent, tt.count
         FROM wp_terms t
         INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
         WHERE tt.taxonomy = 'product_cat' AND tt.parent = ?
         ORDER BY ${dbOrderby} ${dbOrder}`,
        [parent]
      ) as any[];
      
      const formattedCategories: any[] = [];
      
      for (const category of rows) {
        const termId = category.term_id;
        
        // Check if category should be hidden (has no products in stock)
        if (hideEmpty) {
          const [productCountRows] = await pool.execute(
            `SELECT COUNT(DISTINCT p.ID) as count
             FROM wp_posts p
             INNER JOIN wp_postmeta stock_meta ON p.ID = stock_meta.post_id
             INNER JOIN wp_term_relationships tr ON p.ID = tr.object_id
             INNER JOIN wp_term_taxonomy tt_cat ON tr.term_taxonomy_id = tt_cat.term_taxonomy_id
             WHERE p.post_type = 'product'
             AND p.post_status = 'publish'
             AND stock_meta.meta_key = '_stock_status'
             AND stock_meta.meta_value = 'instock'
             AND tt_cat.term_id = ?
             AND tt_cat.taxonomy = 'product_cat'`,
            [termId]
          ) as any[];
          
          const productCount = productCountRows[0]?.count || 0;
          if (productCount === 0) {
            continue;
          }
        }
        
        // Get category image
        let imageUrl: string | null = null;
        const [imageIdRows] = await pool.execute(
          "SELECT meta_value FROM wp_termmeta WHERE term_id = ? AND meta_key = 'thumbnail_id'",
          [termId]
        ) as any[];
        
        const imageId = imageIdRows && imageIdRows.length > 0 ? parseInt(imageIdRows[0].meta_value) : 0;
        if (imageId > 0) {
          const [imgRows] = await pool.execute(
            'SELECT guid FROM wp_posts WHERE ID = ?',
            [imageId]
          ) as any[];
          if (imgRows && imgRows.length > 0) {
            imageUrl = fixImageUrl(imgRows[0].guid);
          }
        }
        
        // Get parent category info
        let parentInfo: any = null;
        if (category.parent > 0) {
          const [parentRows] = await pool.execute(
            'SELECT t.term_id, t.name FROM wp_terms t WHERE t.term_id = ?',
            [category.parent]
          ) as any[];
          
          if (parentRows && parentRows.length > 0) {
            const parentRow = parentRows[0];
            const [parentImageIdRows] = await pool.execute(
              "SELECT meta_value FROM wp_termmeta WHERE term_id = ? AND meta_key = 'thumbnail_id'",
              [category.parent]
            ) as any[];
            
            let parentImageUrl: string | null = null;
            const parentImageId = parentImageIdRows && parentImageIdRows.length > 0 
              ? parseInt(parentImageIdRows[0].meta_value) 
              : 0;
            if (parentImageId > 0) {
              const [parentImgRows] = await pool.execute(
                'SELECT guid FROM wp_posts WHERE ID = ?',
                [parentImageId]
              ) as any[];
              if (parentImgRows && parentImgRows.length > 0) {
                parentImageUrl = fixImageUrl(parentImgRows[0].guid);
              }
            }
            
            parentInfo = {
              id: parentRow.term_id,
              name: parentRow.name,
              image: parentImageUrl ? { sourceUrl: parentImageUrl } : null,
            };
          }
        }
        
        // Get children categories
        const [childrenRows] = await pool.execute(
          `SELECT t.term_id, t.name
           FROM wp_terms t
           INNER JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
           WHERE tt.taxonomy = 'product_cat' AND tt.parent = ?`,
          [termId]
        ) as any[];
        
        const childrenCategories: any[] = [];
        for (const child of childrenRows) {
          const [childImageIdRows] = await pool.execute(
            "SELECT meta_value FROM wp_termmeta WHERE term_id = ? AND meta_key = 'thumbnail_id'",
            [child.term_id]
          ) as any[];
          
          let childImageUrl: string | null = null;
          const childImageId = childImageIdRows && childImageIdRows.length > 0 
            ? parseInt(childImageIdRows[0].meta_value) 
            : 0;
          if (childImageId > 0) {
            const [childImgRows] = await pool.execute(
              'SELECT guid FROM wp_posts WHERE ID = ?',
              [childImageId]
            ) as any[];
            if (childImgRows && childImgRows.length > 0) {
              childImageUrl = fixImageUrl(childImgRows[0].guid);
            }
          }
          
          // Check if child has products
          const [childProductCountRows] = await pool.execute(
            `SELECT COUNT(DISTINCT p.ID) as count
             FROM wp_posts p
             INNER JOIN wp_postmeta stock_meta ON p.ID = stock_meta.post_id
             INNER JOIN wp_term_relationships tr ON p.ID = tr.object_id
             INNER JOIN wp_term_taxonomy tt_cat ON tr.term_taxonomy_id = tt_cat.term_taxonomy_id
             WHERE p.post_type = 'product'
             AND p.post_status = 'publish'
             AND stock_meta.meta_key = '_stock_status'
             AND stock_meta.meta_value = 'instock'
             AND tt_cat.term_id = ?
             AND tt_cat.taxonomy = 'product_cat'`,
            [child.term_id]
          ) as any[];
          
          const hasProducts = (childProductCountRows[0]?.count || 0) > 0;
          
          childrenCategories.push({
            id: child.term_id,
            name: child.name,
            image: childImageUrl ? { sourceUrl: childImageUrl } : null,
            parent: {
              node: {
                id: termId,
                name: category.name,
                image: imageUrl ? { sourceUrl: imageUrl } : null,
              }
            },
            products: {
              nodes: hasProducts ? [{ id: '1' }] : []
            },
          });
        }
        
        // Check if category has products
        const [productCountRows] = await pool.execute(
          `SELECT COUNT(DISTINCT p.ID) as count
           FROM wp_posts p
           INNER JOIN wp_postmeta stock_meta ON p.ID = stock_meta.post_id
           INNER JOIN wp_term_relationships tr ON p.ID = tr.object_id
           INNER JOIN wp_term_taxonomy tt_cat ON tr.term_taxonomy_id = tt_cat.term_taxonomy_id
           WHERE p.post_type = 'product'
           AND p.post_status = 'publish'
           AND stock_meta.meta_key = '_stock_status'
           AND stock_meta.meta_value = 'instock'
           AND tt_cat.term_id = ?
           AND tt_cat.taxonomy = 'product_cat'`,
          [termId]
        ) as any[];
        
        const productCount = productCountRows[0]?.count || 0;
        
        formattedCategories.push({
          id: termId,
          name: category.name,
          image: imageUrl ? { sourceUrl: imageUrl } : null,
          parent: parentInfo ? { node: parentInfo } : null,
          products: {
            nodes: productCount > 0 ? [{ id: '1' }] : []
          },
          children: {
            nodes: childrenCategories
          },
        });
      }
      
      return {
        productCategories: {
          nodes: formattedCategories
        }
      };
    } catch (error: any) {
      console.error('[categories] Error:', error);
      throw createError({
        statusCode: 500,
        message: error?.message || 'Failed to fetch categories',
      });
    }
  },
  {
    maxAge: 1,
    swr: false,
  }
);
