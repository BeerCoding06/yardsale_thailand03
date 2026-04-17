import Joi from 'joi';

const emailRule = Joi.string().email({ tlds: { allow: false } }).trim().lowercase();

const uuid = Joi.string().uuid({ version: 'uuidv4' });

const productListingStatus = Joi.string()
  .valid('pending_review', 'published', 'hidden')
  .optional();

/** ต้องตรงกับ MODERATION_ISSUE_KEYS ใน product.model.js และแอดมิน review modal */
const moderationIssueKeySchema = Joi.string().valid(
  'photos',
  'title_name',
  'description',
  'price',
  'category',
  'stock',
  'tags',
  'illegal_or_prohibited',
  'other'
);

export const loginSchema = Joi.object({
  username: Joi.string().trim().optional(),
  email: emailRule.optional(),
  password: Joi.string().required(),
})
  .or('username', 'email')
  .messages({ 'object.missing': 'username or email is required' });

export const createUserSchema = Joi.object({
  email: emailRule.required(),
  password: Joi.string().min(8).required(),
  username: Joi.string().trim().optional(),
  name: Joi.string().trim().allow('').default(''),
  role: Joi.string().valid('user', 'seller', 'admin', 'customer').default('user'),
  account_status: Joi.string().valid('public', 'pending', 'block').optional(),
});

export const adminUserIdParamsSchema = Joi.object({
  id: uuid.required(),
});

export const adminUpdateUserSchema = Joi.object({
  email: emailRule.optional(),
  name: Joi.string().trim().allow('').optional(),
  role: Joi.string().valid('user', 'seller', 'admin', 'customer').optional(),
  account_status: Joi.string().valid('public', 'pending', 'block').optional(),
  password: Joi.string().min(8).optional(),
}).or('email', 'name', 'role', 'account_status', 'password');

export const checkEmailSchema = Joi.object({
  email: emailRule.required(),
});

export const cartAddSchema = Joi.object({
  product_id: uuid.required(),
  quantity: Joi.number().integer().min(1).default(1),
});

export const cartUpdateSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product_id: uuid.required(),
        quantity: Joi.number().integer().min(0).required(),
      })
    )
    .required(),
});

export const cartStockBodySchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product_id: uuid.required(),
        quantity: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required(),
});

export const createOrderSchema = Joi.object({
  line_items: Joi.array()
    .items(
      Joi.object({
        product_id: uuid.required(),
        quantity: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required(),
}).unknown(true);

export const cancelOrderSchema = Joi.object({
  order_id: uuid.required(),
});

export const sellerOrderFulfillmentParamsSchema = Joi.object({
  orderId: uuid.required(),
});

export const patchSellerOrderFulfillmentSchema = Joi.object({
  /** ไม่ใช้จากฝั่งผู้ขายแล้ว — สถานะคำนวณจากเลขพัสดุ + 17TRACK ที่เซิร์ฟเวอร์ */
  shipping_status: Joi.string()
    .valid('pending', 'preparing', 'shipped', 'out_for_delivery', 'delivered')
    .optional(),
  tracking_number: Joi.string().trim().allow('', null).optional(),
  shipping_receipt_number: Joi.string().trim().allow('', null).optional(),
  courier_name: Joi.string().trim().allow('', null).optional(),
}).or('tracking_number', 'shipping_receipt_number', 'courier_name', 'shipping_status');

export const paymentMockSchema = Joi.object({
  order_id: uuid.required(),
  simulate_failure: Joi.boolean().default(false),
});

/** After multer — fields are often strings */
export const paymentMockBodySchema = Joi.object({
  order_id: uuid.required(),
  simulate_failure: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0'))
    .default('false'),
  amount: Joi.alternatives().try(Joi.number().positive(), Joi.valid(null, '')),
  /** ธนาคารที่ลูกค้าโอนมา (รหัสเดียวกับ bank_options ในหน้า payment) */
  transfer_bank: Joi.string().trim().max(32).allow('', null).optional(),
  slip_data: Joi.string().trim().allow('', null).optional(),
  slip_url: Joi.string().uri({ scheme: ['http', 'https'] }).allow('', null).optional(),
  log: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0'))
    .optional(),
}).unknown(true);

export const createProductSchema = Joi.object({
  name: Joi.string().trim().min(1).required(),
  description: Joi.string().allow('').default(''),
  /** ราคาที่ลูกค้าจ่าย (legacy) — ใช้คู่กับ regular_price / sale_price ได้ */
  price: Joi.number().precision(2).positive().optional(),
  regular_price: Joi.number().precision(2).positive().optional(),
  sale_price: Joi.alternatives()
    .try(Joi.number().precision(2).positive(), Joi.valid(null, ''))
    .optional(),
  stock: Joi.number().integer().min(0).default(0),
  category_id: uuid.allow(null, '').optional(),
  image_url: Joi.alternatives()
    .try(
      Joi.string().uri({ scheme: ['http', 'https'] }),
      Joi.string().pattern(/^\//)
    )
    .allow('', null)
    .optional(),
  image_urls: Joi.array()
    .items(
      Joi.alternatives().try(
        Joi.string().uri({ scheme: ['http', 'https'] }),
        Joi.string().pattern(/^\//)
      )
    )
    .max(10)
    .optional(),
  /** Admin only: assign product to this seller user */
  seller_id: uuid.optional(),
  /** Admin only: initial listing status (seller/user → always pending_review on server) */
  listing_status: productListingStatus,
  tag_ids: Joi.array().items(uuid).max(100).optional(),
})
  .or('price', 'regular_price')
  .messages({
    'object.missing': 'price or regular_price is required',
  });

export const updateProductSchema = Joi.object({
  product_id: uuid.required(),
  name: Joi.string().trim().min(1).optional(),
  description: Joi.string().allow('').optional(),
  price: Joi.number().precision(2).positive().optional(),
  regular_price: Joi.number().precision(2).positive().optional(),
  sale_price: Joi.alternatives()
    .try(Joi.number().precision(2).positive(), Joi.valid(null, ''))
    .optional(),
  stock: Joi.number().integer().min(0).optional(),
  category_id: uuid.allow(null, '').optional(),
  image_url: Joi.alternatives()
    .try(
      Joi.string().uri({ scheme: ['http', 'https'] }),
      Joi.string().pattern(/^\//)
    )
    .allow('', null)
    .optional(),
  image_urls: Joi.array()
    .items(
      Joi.alternatives().try(
        Joi.string().uri({ scheme: ['http', 'https'] }),
        Joi.string().pattern(/^\//)
      )
    )
    .max(10)
    .optional(),
  /** Admin only: publish / hide from storefront */
  listing_status: productListingStatus,
  tag_ids: Joi.array().items(uuid).max(100).optional(),
  /** Admin only: บันทึกเป็น moderation_feedback ให้ผู้ขายเห็นใน my-products / แก้ไขสินค้า */
  moderation_issue_keys: Joi.array().items(moderationIssueKeySchema).max(20).optional(),
  moderation_message: Joi.string().trim().allow('', null).max(10000).optional(),
})
  .or(
    'name',
    'description',
    'price',
    'regular_price',
    'sale_price',
    'stock',
    'category_id',
    'image_url',
    'image_urls',
    'listing_status',
    'tag_ids',
    'moderation_issue_keys',
    'moderation_message'
  )
  .messages({
    'object.missing': 'at least one field to update is required',
  });

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  slug: Joi.string().trim().lowercase().max(200).allow('', null).optional(),
  image_url: Joi.alternatives()
    .try(
      Joi.string().uri({ scheme: ['http', 'https'] }),
      Joi.string().pattern(/^\//)
    )
    .allow('', null)
    .optional(),
});

export const updateCategorySchema = Joi.object({
  category_id: uuid.required(),
  name: Joi.string().trim().min(1).max(200).optional(),
  slug: Joi.string().trim().lowercase().max(200).allow('', null).optional(),
  image_url: Joi.alternatives()
    .try(
      Joi.string().uri({ scheme: ['http', 'https'] }),
      Joi.string().pattern(/^\//)
    )
    .allow(null, '')
    .optional(),
})
  .or('name', 'slug', 'image_url')
  .messages({
    'object.missing': 'at least one of name, slug, image_url is required',
  });

export const deleteCategorySchema = Joi.object({
  category_id: uuid.required(),
});

export const createTagSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  slug: Joi.string().trim().lowercase().max(200).allow('', null).optional(),
});

export const updateTagSchema = Joi.object({
  tag_id: uuid.required(),
  name: Joi.string().trim().min(1).max(200).optional(),
  slug: Joi.string().trim().lowercase().max(200).allow('', null).optional(),
})
  .or('name', 'slug')
  .messages({
    'object.missing': 'at least one of name, slug is required',
  });

export const deleteTagSchema = Joi.object({
  tag_id: uuid.required(),
});

export const productActionSchema = Joi.object({
  product_id: uuid.required(),
});

/** POST /api/track — 17TRACK lookup */
export const trackShipmentSchema = Joi.object({
  trackingNumber: Joi.string().trim().min(3).max(100).required(),
  /** Optional 17TRACK carrier key when auto-detect fails */
  carrier: Joi.number().integer().positive().optional(),
});

export {
  saveFcmTokenSchema,
  sendFcmNotificationSchema,
  broadcastFcmSchema,
} from './fcmSchemas.js';
