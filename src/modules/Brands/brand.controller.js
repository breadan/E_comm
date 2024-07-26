import slugify from 'slugify';

import Brand from '../../../DB/Models/brand.model.js';
import subCategory from '../../../DB/Models/sub-category.model.js';
import cloudinaryConnection from '../../utils/cloudinary.js';
import generateUniqueString from '../../utils/generate-Unique-String.js';
import { systemRoles } from '../../utils/system-roles.js';

//======================= add brand =======================//
export const addBrand = async (req, res, next) => {
  // 1- distract the required data from teh request object
  const { name } = req.body;
  const { categoryId, subCategoryId } = req.query;
  const { _id } = req.authUser;

  // category check , subcategory check
  // 2- subcategory check
  const subCategoryCheck = await subCategory
    .findById(subCategoryId)
    .populate('categoryId', 'folderId');
  // console.log(subCategoryCheck)
  if (!subCategoryCheck)
    return next({ message: 'SubCategory not found', cause: 404 });

  // 3- duplicate  brand document check
  const isBrandExists = await Brand.findOne({ name, subCategoryId });
  if (isBrandExists)
    return next({
      message: 'Brand already exists for this subCategory',
      cause: 400,
    });
  // console.log(categoryId, subCategoryCheck.categoryId._id);
  // 4- category check
  if (categoryId != subCategoryCheck.categoryId._id)
    return next({ message: 'Category not found', cause: 404 });

  // 5 - generate the slug
  const slug = slugify(name, '-');

  // 6- upload brand logo
  if (!req.file)
    return next({ message: 'Please upload the brand logo', cause: 400 });

  const folderId = generateUniqueString(4);
  const { secure_url, public_id } =
    await cloudinaryConnection().uploader.upload(req.file.path, {
      folder: `${process.env.MAIN_FOLDER}/Categories/${subCategoryCheck.categoryId.folderId}/SubCategories/${subCategoryCheck.folderId}/Brands/${folderId}`,
    });

  const brandObject = {
    name,
    slug,
    Image: { secure_url, public_id },
    folderId,
    addedBy: _id,
    subCategoryId,
    categoryId,
  };

  const newBrand = await Brand.create(brandObject);

  res.status(201).json({
    status: 'success',
    message: 'Brand added successfully',
    data: newBrand,
  });
};

//======================= add brand =======================//
export const updateBrand = async (req, res, next) => {
  //data from body
  const { name, oldPublicId } = req.body;
  const { brandId } = req.params;
  const { subCategoryId } = req.query;
  const addedBy = req.authUser._id;

  //check brand
  const brand = await Brand.findById(brandId);

  if (!brand) return next({ message: 'Brand not found', cause: 404 });

  if (
    req.authUser.role !== systemRoles.ADMIN &&
    brand.addedBy.toString() !== addedBy.toString()
  )
    return next({
      cause: 403,
      message: 'You are not authorized to update this product',
    });
  // 3- duplicate  brand document check
  const isBrandExists = await Brand.findOne({ name, subCategoryId });
  if (isBrandExists)
    return next({
      message: 'Brand already exists for this subCategory',
      cause: 400,
    });

  // generate the slug
  if (name) {
    brand.name = name;
    brand.slug = slugify(name, '-');
  }
  //ecommerce-project/Categories/2gs2/SubCategories/4g1f/Brands/44ds/lkfxpheqbjsmftn0bec1
  if (oldPublicId) {
    if (!req.file) {
      return next({ cause: 400, message: 'Image is required' });
    }
    const newPublicId = oldPublicId.split(`${brand.folderId}/`)[1];
    const folderPath = brand.Image.public_id.split(`${brand.folderId}/`);

    console.log(newPublicId);
    const { secure_url, public_id } =
      await cloudinaryConnection().uploader.upload(req.file.path, {
        folder: folderPath + `${brand.folderId}`,
        public_id: newPublicId,
      });
    console.log({ secure_url, public_id });

    req.folder = folderPath + `${brand.folderId}`;
  }

  await brand
    .save()
    .then(
      res.status(200).json({
        success: true,
        message: 'Brand updated successfully',
        data: brand,
      })
    )
    .catch((err) => {
      err;
    });
};
