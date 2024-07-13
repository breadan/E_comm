import { Router } from 'express';
const router = Router();
import * as categoryController from './category.controller.js';
import expressAsyncHandler from 'express-async-handler';
import { multerMiddleHost } from '../../middlewares/multer.js';
import { endPointsRoles } from './category.endpoints.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { allowedExtensions } from '../../utils/allowed-extensions.js';

router.post(
  '/',
  auth(endPointsRoles.ADD_CATEGORY),
  multerMiddleHost({
    extensions: allowedExtensions.image,
  }).single('image'),
  expressAsyncHandler(categoryController.addCategory)
);

router.put(
  'updateCategory/:categoryId',
  auth(endPointsRoles.ADD_CATEGORY),
  multerMiddleHost({
    extensions: allowedExtensions.image,
  }).single('image'),
  expressAsyncHandler(categoryController.updateCategory)
);

router.get('/', expressAsyncHandler(categoryController.getAllCategories));
//================= Delete Category ============================
router.delete(
  '/deleteCategory/:categoryId',
  auth(endPointsRoles.ADD_CATEGORY),
  expressAsyncHandler(categoryController.deleteCategory)
);
export default router;
