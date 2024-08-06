import { Router } from 'express';
import expressAsyncHandler from 'express-async-handler';

import * as productController from './product.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { multerMiddleHost } from '../../middlewares/multer.js';
import { allowedExtensions } from '../../utils/allowed-extensions.js';
import { endPointsRoles } from './product.endpoints.js';
const router = Router();
//********************* Create Product *************************** */
router.post(
  '/createProduct',
  auth(endPointsRoles.ADD_PRODUCT),
  multerMiddleHost({ extensions: allowedExtensions.image }).array('image', 3),
  expressAsyncHandler(productController.addProduct)
);

//********************* Update Product *************************** */
router.put(
  '/updateProduct/:productId',
  auth(endPointsRoles.ADD_PRODUCT),
  multerMiddleHost({ extensions: allowedExtensions.image }).single('image'),
  expressAsyncHandler(productController.updateProduct)
);

//********************* All Products *************************** */
router.get(
  '/allProducts2',
  expressAsyncHandler(productController.getAllProducts2)
);

router.get(
  '/allProducts',
  expressAsyncHandler(productController.getAllProducts)
);

export default router;
