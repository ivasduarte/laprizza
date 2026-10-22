import mongoose from 'mongoose';

/**
 * Collation used to compare product category names without using distinguishing uppercase from lowercase letters and accents.
 * Example: "Café", "Cafe" and "cafe" are considered the same descriptive name.
 * 
 * It must also be used in the queries that check/search by name, so that they match the unique index below.
 * 
 * - locale: the language whose rules are used in comparison.
 * - strength: the comparison level. "1" compares only the base letters, ignoring case and accents. 
 */
export const NAME_COLLATION = {locale: 'en', strength: 1};

/**
 * Mongoose schema defining the structure of the Product Category collection in the database.
 * The 'name' field is required.
 * 
 * @type {mongoose.Schema}
 */
const productCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
});

/**
 * Unique, case- and accent- insensitive index on 'name'.
 * Business Rule: Two product categories cannot have the same name.
 * This index is the last line of defense against duplicates created by simultaneous requests since the service check alone cannot prevent them.
 */
productCategorySchema.index({name: 1}, {unique: true, collation: NAME_COLLATION, partialFilterExpression: { isActive: true }});

/**
 * Compiled Mongoose model for the product categories collection.
 * @type {mongoose.Model}
 */
export default mongoose.model('Product Categories', productCategorySchema);