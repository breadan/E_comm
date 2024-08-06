import slugify from 'slugify';

import Brand from '../../../DB/Models/brand.model.js';
import Product from '../../../DB/Models/product.model.js';
import { systemRoles } from '../../utils/system-roles.js';
import cloudinaryConnection from '../../utils/cloudinary.js';
import generateUniqueString from '../../utils/generate-Unique-String.js';
import { APIFeatures } from '../../utils/api-features.js';
import { paginationFunction } from '../../utils/pagination.js';

/**
 *
 * @param {*} req body: {title, desc, basePrice, discount, stock, specs}  authUser
 * @param {*} req query: {categoryId, subCategoryId, brandId}
 * @param {*} req authUser :{_id}
 * @returns the created product data with status 201 and success message
 * @description add a product to the database
 */

//====================== Add product API ============================//
export const addProduct = async (req, res, next) => {
  // data from the request body
  const { title, desc, basePrice, discount, stock, specs } = req.body;
  // data from the request query
  const { categoryId, subCategoryId, brandId } = req.query;
  // data from the request authUser
  const addedBy = req.authUser._id;

  // brand check
  const brand = await Brand.findById(brandId);
  if (!brand) return next({ cause: 404, message: 'Brand not found' });

  // category check
  if (brand.categoryId.toString() !== categoryId)
    return next({ cause: 400, message: 'Brand not found in this category' });
  // sub-category check
  if (brand.subCategoryId.toString() !== subCategoryId)
    return next({
      cause: 400,
      message: 'Brand not found in this sub-category',
    });

  // who will be authorized to add a product
  if (
    req.authUser.role !== systemRoles.SUPER_ADMIN &&
    brand.addedBy.toString() !== addedBy.toString()
  )
    return next({
      cause: 403,
      message: 'You are not authorized to add a product to this brand',
    });

  // generate the product  slug
  const slug = slugify(title, { lower: true, replacement: '-' }); //  lowercase: true

  //  applied price calculations
  const appliedPrice = basePrice - (basePrice * (discount || 0)) / 100;

  // console.log(specs);

  //Images
  const folderId = generateUniqueString(4);
  const Images = [];

  if (!req.files.length)
    return next({ cause: 400, message: 'Images are required' });

  // ecommerce-project/Categories/4aa3/SubCategories/fhgf/Brands/5asf/z2wgc418otdljbetyotn
  const folder = brand.Image.public_id.split(`${brand.folderId}/`)[0];
  for (const file of req.files) {
    // console.log(folder);
    // console.log(folder + `${brand.folderId}` + `/Products/${folderId}`);

    const { secure_url, public_id } =
      await cloudinaryConnection().uploader.upload(file.path, {
        folder: folder + `${brand.folderId}` + `/Products/${folderId}`,
      });
    Images.push({ secure_url, public_id });
  }
  req.folder = folder + `${brand.folderId}` + `/Products/${folderId}`;

  // prepare the product object for db
  const product = {
    title,
    desc,
    slug,
    basePrice,
    discount,
    appliedPrice,
    stock,
    specs: JSON.parse(specs),
    categoryId,
    subCategoryId,
    brandId,
    addedBy,
    Images,
    folderId,
  };
  const newProduct = await Product.create(product);
  req.savedDocument = { model: Product, _id: newProduct._id };

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: newProduct,
  });
};

/**
 *
 * @param {*} req body: {title, desc, basePrice, discount, stock, specs}
 * @param {*} req params : {productId}
 * @param {*} req authUser :{_id}
 * @returns the updated product data with status 200 and success message
 * @description update a product in the database
 */

//====================== Update product API ===============================//
export const updateProduct = async (req, res, next) => {
  // data from the request body
  const { title, desc, specs, stock, basePrice, discount, oldPublicId } =
    req.body; //oldPublicId of image
  // data for condition
  const { productId } = req.params;
  // data from the request authUser
  const addedBy = req.authUser._id;

  // product Id
  const product = await Product.findById(productId);
  if (!product) return next({ cause: 404, message: 'Product not found' });

  // who will be authorized to update a product
  if (
    req.authUser.role !== systemRoles.SUPER_ADMIN &&
    product.addedBy.toString() !== addedBy.toString()
  )
    return next({
      cause: 403,
      message: 'You are not authorized to update this product',
    });
  // title update
  if (title) {
    product.title = title;
    product.slug = slugify(title, { lower: true, replacement: '-' });
  }
  if (desc) product.desc = desc;
  if (specs) product.specs = JSON.parse(specs);
  if (stock) product.stock = stock;

  // prices changes //it is stander
  const appliedPrice =
    (basePrice || product.basePrice) *
    (1 - (discount || product.discount) / 100);
  product.appliedPrice = appliedPrice;

  if (basePrice) product.basePrice = basePrice;
  if (discount) product.discount = discount;

  if (oldPublicId) {
    //of image
    if (!req.file)
      return next({ cause: 400, message: 'Please select new image' });

    const folderPath = product.Images[0].public_id.split(
      `${product.folderId}/`
    )[0];
    const newPublicId = oldPublicId.split(`${product.folderId}/`)[1];

    // console.log('folderPath', folderPath)
    // console.log('newPublicId', newPublicId)
    // console.log(`oldPublicId`, oldPublicId);

    const { secure_url } = await cloudinaryConnection().uploader.upload(
      req.file.path,
      {
        folder: folderPath + `${product.folderId}`,
        public_id: newPublicId,
      }
    );
    product.Images.map((img) => {
      if (img.public_id === oldPublicId) {
        img.secure_url = secure_url;
      }
    });
    req.folder = folderPath + `${product.folderId}`;
  }

  await product.save();

  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: product,
  });
};

//================= get all products API ===============================//
export const getAllProducts = async (req, res, next) => {
  const { page, size, sort, ...search } = req.query;
  //take new instances from ApiFeatures
  const features = new APIFeatures(req.query, Product.find())
    // .sort(sort);
    // .pagination({ page, size });
    // .search(search);
    .filters(search);

  // console.log(features.mongooseQuery);
  const products = await features.mongooseQuery;
  res.status(200).json({ success: true, message: '', data: products });
};
/**
 * to replace any string from frontEnd:
 * const formula = sort.replace(/desc/g, 1).replace(/asc/g, 1).replace(/ /g, ':')
 * formula is string and we must convert it to object to send to DB
 * const splitedKey = formula.split(':')
 * const totalDocs = await Product.find().sort({key:value})
 */

//==================== get All product  ============================//
export const getAllProducts2 = async (req, res, next) => {
  const { page, size } = req.query;
  // const data = paginationFunction({ page, size });

  // console.log(data);
  const { limit, skip } = paginationFunction({ page, size });
  const products = await Product.find().limit(limit).skip(skip);
  res.status(200).json({ success: true, data: products });
};
