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
  sellerOrderFulfillmentParamsSchema,
  patchSellerOrderFulfillmentSchema,
  createProductSchema,
  updateProductSchema,
  productActionSchema,
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
  createTagSchema,
  updateTagSchema,
  deleteTagSchema,
  trackShipmentSchema,
  saveFcmTokenSchema,
  sendFcmNotificationSchema,
  broadcastFcmSchema,
  walletWithdrawBodySchema,
  adminWithdrawalIdParamsSchema,
  adminWithdrawalActionBodySchema,
  adminSellerWalletParamsSchema,
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
import * as trackController from '../controllers/track.controller.js';
import * as fcmController from '../controllers/fcm.controller.js';
import * as walletController from '../controllers/wallet.controller.js';
import * as adminWalletController from '../controllers/adminWallet.controller.js';
import { trackRateLimit } from '../middlewares/trackRateLimit.js';
import { fcmBroadcastRateLimit, fcmSendNotificationRateLimit } from '../middlewares/fcmRateLimit.js';

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
router.post(
  '/admin/orders/:orderId/mark-paid',
  authMiddleware,
  requireRoles('admin'),
  validate(sellerOrderFulfillmentParamsSchema, 'params'),
  orderController.markOrderPaidAdmin
);
router.post(
  '/admin/orders/:orderId/mark-delivered',
  authMiddleware,
  requireRoles('admin'),
  validate(sellerOrderFulfillmentParamsSchema, 'params'),
  orderController.adminMarkOrderDelivered
);
router.post('/check-email', validate(checkEmailSchema), authController.checkEmail);

/** Shipment tracking (17TRACK) — see backend/docs/TRACKING_API.md */
router.post('/track', trackRateLimit, validate(trackShipmentSchema), trackController.trackShipment);

router.post('/save-token', authMiddleware, validate(saveFcmTokenSchema), fcmController.saveToken);
router.post(
  '/save-fcm-token',
  authMiddleware,
  validate(saveFcmTokenSchema),
  fcmController.saveToken
);
router.post(
  '/send-notification',
  authMiddleware,
  requireRoles('admin'),
  fcmSendNotificationRateLimit,
  validate(sendFcmNotificationSchema),
  fcmController.sendNotification
);
router.post(
  '/broadcast',
  authMiddleware,
  requireRoles('admin'),
  fcmBroadcastRateLimit,
  validate(broadcastFcmSchema),
  fcmController.broadcast
);

router.get('/products', productController.listProducts);
router.get('/product/:id', optionalAuth, productController.getProduct);
router.get('/search', productController.search);
router.get('/wp-post', optionalAuth, productController.wpPost);

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
router.get(
  '/seller-orders',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  orderController.sellerOrders
);
router.patch(
  '/seller-orders/:orderId/fulfillment',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  validate(sellerOrderFulfillmentParamsSchema, 'params'),
  validate(patchSellerOrderFulfillmentSchema),
  orderController.patchSellerOrderFulfillment
);
router.post(
  '/orders/:orderId/confirm-delivery',
  authMiddleware,
  validate(sellerOrderFulfillmentParamsSchema, 'params'),
  orderController.confirmBuyerDelivery
);
router.post('/cancel-order', authMiddleware, validate(cancelOrderSchema), orderController.cancelOrder);

router.get(
  '/wallet',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  walletController.getWallet
);
router.get(
  '/wallet/bank-options',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  walletController.getWithdrawalBankOptions
);
router.post(
  '/wallet/withdraw',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  validate(walletWithdrawBodySchema),
  walletController.postWithdraw
);
router.get(
  '/wallet/withdrawals',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  walletController.getWithdrawals
);

router.get(
  '/admin/wallet/dashboard',
  authMiddleware,
  requireRoles('admin'),
  adminWalletController.getWalletDashboard
);
router.get(
  '/admin/withdrawals',
  authMiddleware,
  requireRoles('admin'),
  adminWalletController.getAdminWithdrawals
);
router.post(
  '/admin/withdrawals/:id/approve',
  authMiddleware,
  requireRoles('admin'),
  validate(adminWithdrawalIdParamsSchema, 'params'),
  validate(adminWithdrawalActionBodySchema),
  adminWalletController.postApproveWithdrawal
);
router.post(
  '/admin/withdrawals/:id/reject',
  authMiddleware,
  requireRoles('admin'),
  validate(adminWithdrawalIdParamsSchema, 'params'),
  validate(adminWithdrawalActionBodySchema),
  adminWalletController.postRejectWithdrawal
);
router.post(
  '/admin/withdrawals/:id/mark-paid',
  authMiddleware,
  requireRoles('admin'),
  validate(adminWithdrawalIdParamsSchema, 'params'),
  adminWalletController.postMarkWithdrawalPaid
);
router.get(
  '/admin/sellers/:sellerId/wallet',
  authMiddleware,
  requireRoles('admin'),
  validate(adminSellerWalletParamsSchema, 'params'),
  adminWalletController.getAdminSellerWallet
);

router.post('/payment/mock', authMiddleware, (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return uploadImage.single('slip_image')(req, res, next);
  }
  next();
}, paymentController.mockPayment);
router.get('/payment/slipok/quota', authMiddleware, paymentController.slipokQuota);

/** user / seller / admin — ลงขายและจัดการสินค้าของตนได้ (แอดมินมีโหมด CMS แยกที่ /admin) */
router.get(
  '/my-products',
  authMiddleware,
  requireRoles('user', 'seller', 'admin'),
  sellerController.myProducts
);
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
