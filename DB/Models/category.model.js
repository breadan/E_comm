import mongoose, { Schema, model } from 'mongoose';

//============================== create the category schema ==============================//
const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    Image: {
      secure_url: { type: String, required: true },
      public_id: { type: String, required: true, unique: true },
    },
    folderId: { type: String, required: true, unique: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // superAdmin
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // superAdmin
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// virtual populate for subCategories model
categorySchema.virtual('subcategories', {
  ref: 'SubCategory',
  localField: '_id', //from category
  foreignField: 'categoryId',
  // justOne: true  //to show one subcategory
});

export default mongoose.model.Category || model('Category', categorySchema);

/**
 * nodeJs
 * javascript
 * expressJs
 * nestJs
 * mongoDB
 * mysql
 * sequelize
 * mongoose
 * graphql
 * socket.io
 * typescript
 */
