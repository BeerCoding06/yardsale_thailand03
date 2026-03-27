import { Router } from 'express';
import { authMiddleware, requireRoles, optionalAuth } from '../middlewares/authMiddleware.js';
import { createUserAccess } from '../middlewares/createUserAccess.js';
import { validate } from '../middlewares/validate.js';
import {
  loginSchema,
  createUserSchema,
  adminUserIdParamsSchema,
  adminUpdateUserSchema,
  checkEmailSchema,
  cartAddSchema,
  cartUpdateSchema,
  cartStockBodySchema,
  createOrderSchema,
  cancelOrderSchema,
  createProductSchema,
  updateProductSchema,
  productActionSchema,
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
  createTagSchema,
  updateTagSchema,
  deleteTagSchema,
} from '../validators/schemas.js';
import { uploadImage } from '../middlewares/upload.js';
import * as authController from '../controllers/auth.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as categoryController from '../controllers/category.controller.js';
import * as tagController from '../controllers/tag.controller.js';
import * as cartController from '../controllers/cart.controller.js';
import * as orderController from '../controllers/order.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import * as sellerController from '../controllers/seller.controller.js';

const router = Router();

router.post('/login', validate(loginSchema), authController.login);
router.post(
  '/create-user',
  validate(createUserSchema),
  createUserAccess,
  authController.createUser
);
router.get('/me', authMiddleware, authController.me);
router.get('/admin/users', authMiddleware, requireRoles('admin'), authController.adminListUsers);
router.patch(
  '/admin/users/:id',
  authMiddleware,
  requireRoles('admin'),
  validate(adminUserIdParamsSchema, 'params'),
  validate(adminUpdateUserSchema),
  authController.adminUpdateUser
);
router.delete(
  '/admin/users/:id',
  authMiddleware,
  requireRoles('admin'),
  validate(adminUserIdParamsSchema, 'params'),
  authController.adminDeleteUser
);
router.post('/check-email', validate(checkEmailSchema), authController.checkEmail);

router.get('/products', productController.listProducts);
router.get('/product/:id', optionalAuth, productController.getProduct);
router.get('/search', productController.search);
router.get('/wp-post', productController.wpPost);

router.get('/categories', categoryController.categories);
router.get('/wp-categories', categoryController.wpCategories);
router.get('/wp-tags', categoryController.wpTags);
router.get('/tags', tagController.listTags);
router.post(
  '/create-tag',
  authMiddleware,
  requireRoles('admin'),
  validate(createTagSchema),
  tagController.createTag
);
router.post(
  '/update-tag',
  authMiddleware,
  requireRoles('admin'),
  validate(updateTagSchema),
  tagController.updateTag
);
router.post(
  '/delete-tag',
  authMiddleware,
  requireRoles('admin'),
  validate(deleteTagSchema),
  tagController.deleteTag
);
router.post(
  '/create-category',
  authMiddleware,
  requireRoles('admin'),
  validate(createCategorySchema),
  categoryController.createCategory
);
router.post(
  '/update-category',
  authMiddleware,
  requireRoles('admin'),
  validate(updateCategorySchema),
  categoryController.updateCategory
);
router.post(
  '/delete-category',
  authMiddleware,
  requireRoles('admin'),
  validate(deleteCategorySchema),
  categoryController.deleteCategory
);

router.post('/cart/add', authMiddleware, validate(cartAddSchema), cartController.add);
router.post('/cart/update', authMiddleware, validate(cartUpdateSchema), cartController.update);
router.post('/refresh-cart-stock', authMiddleware, cartController.refreshStock);
router.post('/check-cart-stock', validate(cartStockBodySchema), cartController.checkStock);

router.post('/create-order', authMiddleware, validate(createOrderSchema), orderController.createOrder);
router.get('/get-order/:id', authMiddleware, orderController.getOrder);
router.get('/my-orders', authMiddleware, orderController.myOrders);
router.get('/seller-orders', authMiddleware, orderController.sellerOrders);
router.post('/cancel-order', authMiddleware, validate(cancelOrderSchema), orderController.cancelOrder);

router.post('/payment/mock', authMiddleware, (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return uploadImage.single('slip_image')(req, res, next);
  }
  next();
}, paymentController.mockPayment);

/** user = ลูกค้าทั่วไป สร้างขายได้เหมือน seller (seller_id = ตัวเอง); admin ยังมองทั้งระบบ */
router.get('/my-products', authMiddleware, requireRoles('user', 'seller', 'admin'), sellerController.myProducts);
router.post(
  '/create-product',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  validate(createProductSchema),
  sellerController.createProduct
);
router.post(
  '/update-product',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  validate(updateProductSchema),
  sellerController.updateProduct
);
router.post(
  '/upload-image',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  uploadImage.single('image'),
  sellerController.uploadImage
);
router.post(
  '/product/cancel',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  validate(productActionSchema),
  sellerController.cancelProduct
);
router.post(
  '/product/restore',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  validate(productActionSchema),
  sellerController.restoreProduct
);

export default router;
