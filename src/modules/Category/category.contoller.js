import Category from '../../../DB/Models/category.model.js'
import slugify from 'slugify'
import cloudinaryConnection from '../../utils/cloudinary.js'
import generateUniqueString from '../../utils/generate-Unique-String.js'

//============================== add category ==============================//
export const addCategory = async (req, res, next) => {
    // 1- destructuring the request body
    const { name } = req.body
    const { _id } = req.authUser

    // 2- check if the category name is already exist
    const isNameDuplicated = await Category.findOne({ name })
    if (isNameDuplicated) {
        return next({ cause: 409, message: 'Category name is already exist' })
        // return next( new Error('Category name is already exist' , {cause:409}) )
    }

    // 3- generate the slug
    const slug = slugify(name, '-')

    // 4- upload image to cloudinary
    if (!req.file) return next({ cause: 400, message: 'Image is required' })

    const folderId = generateUniqueString(4)
    const { secure_url, public_id } = await cloudinaryConnection().uploader.upload(req.file.path, {
        folder: `${process.env.MAIN_FOLDER}/Categories/${folderId}`
    })


    // 5- generate the categroy object
    const category = {
        name,
        slug,
        Image: { secure_url, public_id },
        folderId,
        addedBy: _id
    }
    // 6- create the category
    const categoryCreated = await Category.create(category)
    res.status(201).json({ success: true, message: 'Category created successfully', data: categoryCreated })
}


//================================ upadte category ================================//
export const updateCategory = async (req, res, next) => {
    // 1- destructuring the request body
    const { name, oldPublicId } = req.body
    // 2- destructuring the request params 
    const { categoryId } = req.params
    // 3- destructuring _id from the request authUser
    const { _id } = req.authUser

    // 4- check if the category is exist bu using categoryId
    const category = await Category.findById(categoryId)
    if (!category) return next({ cause: 404, message: 'Category not found' })

    // 5- check if the use want to update the name field
    if (name) {
        // 5.1 check if the new category name different from the old name
        if (name == category.name) {
            return next({ cause: 400, message: 'Please enter different category name from the existing one.' })
        }

        // 5.2 check if the new category name is already exist
        const isNameDuplicated = await Category.findOne({ name })
        if (isNameDuplicated) {
            return next({ cause: 409, message: 'Category name is already exist' })
        }

        // 5.3 update the category name and the category slug
        category.name = name
        category.slug = slugify(name, '-')
    }


    // 6- check if the user want to update the image
    if (oldPublicId) {
        if (!req.file) return next({ cause: 400, message: 'Image is required' })

        const newPulicId = oldPublicId.split(`${category.folderId}/`)[1]

        const { secure_url } = await cloudinaryConnection().uploader.upload(req.file.path, {
            folder: `${process.env.MAIN_FOLDER}/Categories/${category.folderId}`,
            public_id: newPulicId
        })

        category.Image.secure_url = secure_url
    }


    // 7- set value for the updatedBy field
    category.updatedBy = _id

    await category.save()
    res.status(200).json({ success: true, message: 'Category updated successfully', data: category })
}


//============================== get all categories ==============================//
export const getAllCategories = async (req, res, next) => {
    const categories = await Category.find().populate(
        [
            {
                path: 'subcategories',
            }
        ]
    )
    // console.log(categories);
    res.status(200).json({ success: true, message: 'Categories fetched successfully', data: categories })
}