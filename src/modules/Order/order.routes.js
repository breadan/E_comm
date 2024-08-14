import { Router } from 'express';
const router = Router();

import * as orderController from './order.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { systemRoles } from '../../utils/system-roles.js';
import expressAsyncHandler from 'express-async-handler';
import { orderApiRoles } from './order.endPoints.js';

router.post(
  '/',
  auth(orderApiRoles.CREATE_ORDER),
  expressAsyncHandler(orderController.createOrder)
);

router.post(
  '/cartToOrder',
  auth([systemRoles.USER]),
  expressAsyncHandler(orderController.convertFromcartToOrder)
);

router.put(
  '/:orderId',
  auth([systemRoles.DELIEVER_ROLE]),
  expressAsyncHandler(orderController.delieverOrder)
);
//**************************************************** */
router.post(
  '/stripePay/:orderId',
  auth([systemRoles.USER]),
  expressAsyncHandler(orderController.payWithStripe)
);

//test hook
router.post(
  '/webhook',
  expressAsyncHandler(orderController.stripeWebhookLocal)
);

router.post(
  '/refund/:orderId',
  auth([systemRoles.SUPER_ADMIN, systemRoles.ADMIN]),
  expressAsyncHandler(orderController.refundOrder)
);

export default router;
