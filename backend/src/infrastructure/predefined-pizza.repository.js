import PredefinedPizza from './predefined-pizza.model.js';
import PizzaSize from './pizza-size.model.js';
import Products from './products.model.js';
import * as componentTypeRepository from './pizza-component-type.repository.js';
import { escapeRegex } from './utils/escape-regex.js';

const activeCondition = { isActive: { $ne: false } };

const SIZE_CONFIGURATIONS_FIELD = 'sizeConfigurations';

const idOf = (value) => (value ? String(value._id || value) : null);

const toProductInfo = (p) => ({
  id: String(p._id),
  name: p.name,
  isActive: p.isActive !== false,
  sellable: p.sellable === true,
  componentTypeId: idOf(p.pizzaComponentTypeId),
  configuredSizeIds: (p[SIZE_CONFIGURATIONS_FIELD] ?? []).map((c) => String(c.pizzaSizeId)),
});

const toSizeInfo = (s) => ({
  id: String(s._id),
  name: s.name,
  isActive: s.isActive !== false,
});

const toComponentTypeInfo = (t) => ({
  id: String(t._id),
  name: t.name,
  assemblyOrder: t.assemblyOrder,
  minQuantity: t.minQuantity ?? 0,
  maxQuantity: t.maxQuantity ?? null,
});

export async function list() {
  return PredefinedPizza.find({ ...activeCondition }).sort({ createdAt: 1 });
}

// The name belongs to the Product that represents the pizza, so the search goes through the Product first.
export async function search(name) {
  const products = await Products.find({ name: { $regex: escapeRegex(name), $options: 'i' } }).select('_id');
  return PredefinedPizza.find({
    productId: { $in: products.map((p) => p._id) },
    ...activeCondition,
  }).sort({ createdAt: 1 });
}

export async function findByName(name) {
  const product = await Products.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });
  if (!product) return null;
  return PredefinedPizza.findOne({ productId: product._id, ...activeCondition });
}

export async function findById(id) {
  return PredefinedPizza.findOne({ _id: id, ...activeCondition });
}

export async function create(data) {
  return PredefinedPizza.create(data);
}

export async function update(id, data) {
  return PredefinedPizza.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
}

export async function findProductById(id) {
  const product = await Products.findById(id);
  return product ? toProductInfo(product) : null;
}

export async function findProductsByIds(ids) {
  const products = await Products.find({ _id: { $in: ids } });
  return products.map(toProductInfo);
}

export async function findSizesByIds(ids) {
  const sizes = await PizzaSize.find({ _id: { $in: ids } });
  return sizes.map(toSizeInfo);
}

export async function listComponentTypes() {
  const types = await componentTypeRepository.listPizzaComponentTypes();
  return types.map(toComponentTypeInfo);
}

export async function existsWithPizzaSize(sizeId) {
  return (await PredefinedPizza.exists({ sizeIds: sizeId, ...activeCondition })) !== null;
}

export async function existsWithProduct(productId) {
  return (
    (await PredefinedPizza.exists({
      $or: [{ productId }, { 'defaultConfiguration.componentIds': productId }],
      ...activeCondition,
    })) !== null
  );
}

export async function existsPredefinedPizzaWithPizzaSize(sizeId) {
  return (await PredefinedPizza.exists({ sizeIds: sizeId, ...activeCondition })) !== null;
}

export async function existsPredefinedPizzaWithProduct(productId) {
  return (
    (await PredefinedPizza.exists({
      $or: [{ productId }, { 'defaultConfiguration.componentIds': productId }],
      ...activeCondition,
    })) !== null
  );
}
