import Joi from 'joi';

const emailRule = Joi.string().email({ tlds: { allow: false } }).trim().lowercase();

const uuid = Joi.string().uuid({ version: 'uuidv4' });

const productListingStatus = Joi.string()
  .valid('pending_review', 'published', 'hidden')
  .optional();

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
});

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
}).unknown(true);

export const createProductSchema = Joi.object({
  name: Joi.string().trim().min(1).required(),
  description: Joi.string().allow('').default(''),
  price: Joi.number().precision(2).positive().required(),
  stock: Joi.number().integer().min(0).default(0),
  category_id: uuid.allow(null, '').optional(),
  image_url: Joi.alternatives()
    .try(
      Joi.string().uri({ scheme: ['http', 'https'] }),
      Joi.string().pattern(/^\//)
    )
    .allow('', null)
    .optional(),
  /** Admin only: assign product to this seller user */
  seller_id: uuid.optional(),
  /** Admin only: initial listing status (seller/user → always pending_review on server) */
  listing_status: productListingStatus,
});

export const updateProductSchema = Joi.object({
  product_id: uuid.required(),
  name: Joi.string().trim().min(1).optional(),
  description: Joi.string().allow('').optional(),
  price: Joi.number().precision(2).positive().optional(),
  stock: Joi.number().integer().min(0).optional(),
  category_id: uuid.allow(null, '').optional(),
  image_url: Joi.alternatives()
    .try(
      Joi.string().uri({ scheme: ['http', 'https'] }),
      Joi.string().pattern(/^\//)
    )
    .allow('', null)
    .optional(),
  /** Admin only: publish / hide from storefront */
  listing_status: productListingStatus,
})
  .or(
    'name',
    'description',
    'price',
    'stock',
    'category_id',
    'image_url',
    'listing_status'
  )
  .messages({
    'object.missing': 'at least one field to update is required',
  });

export const productActionSchema = Joi.object({
  product_id: uuid.required(),
});
