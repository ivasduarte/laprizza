import { DomainError } from '../domain-error.js';

export function validateProductName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new DomainError('Invalid Product: Name is required and cannot be empty.');
  }
  return name.trim();
}

export function validateProductDescription(description) {
  if (typeof description !== 'string' || description.trim().length === 0) {
    throw new DomainError('Invalid Product: Description is required and cannot be empty.');
  }
  return description.trim();
}

export const AggregateClassification = Object.freeze({
  PRODUCED: 'PRODUCED',
  PURCHASED: 'PURCHASED',
});

export const AggregateErrorCode = Object.freeze({
  INVALID_CLASSIFICATION: 'AGGREGATE_INVALID_CLASSIFICATION',
  INVALID_ITEMS: 'AGGREGATE_INVALID_ITEMS',
  INVALID_QUANTITY: 'AGGREGATE_INVALID_QUANTITY',
  PRODUCED_WITHOUT_ITEMS: 'AGGREGATE_PRODUCED_WITHOUT_ITEMS',
  PURCHASED_WITH_ITEMS: 'AGGREGATE_PURCHASED_WITH_ITEMS',
  DUPLICATE_ITEM: 'AGGREGATE_DUPLICATE_ITEM',
  SELF_REFERENCE: 'AGGREGATE_SELF_REFERENCE',
  ITEM_NOT_FOUND: 'AGGREGATE_ITEM_NOT_FOUND',
  ITEM_INACTIVE: 'AGGREGATE_ITEM_INACTIVE',
  ITEM_IS_PIZZA: 'AGGREGATE_ITEM_IS_PIZZA',
  NESTED: 'AGGREGATE_NESTED',
  OWNER_IS_ITEM: 'AGGREGATE_OWNER_IS_ITEM',
  OWNER_IS_PIZZA: 'AGGREGATE_OWNER_IS_PIZZA',
});

const aggregateError = (message, code) => new DomainError(`Invalid Aggregate: ${message}`, code);

export function normalizeAggregate(aggregate) {
  if (aggregate === undefined || aggregate === null) return null;
  const items = aggregate.items ?? [];

  return {
    classification: aggregate.classification,
    items: Array.isArray(items)
      ? items.map((item) => ({
          productId: String(item?.productId?._id ?? item?.productId),
          quantity: item?.quantity,
        }))
      : items,
  };
}

export function validateAggregateShape(productId, aggregate) {
  if (!Object.values(AggregateClassification).includes(aggregate.classification)) {
    throw aggregateError(
      'Classification must be PRODUCED or PURCHASED.',
      AggregateErrorCode.INVALID_CLASSIFICATION,
    );
  }
  if (!Array.isArray(aggregate.items)) {
    throw aggregateError('Items must be a list.', AggregateErrorCode.INVALID_ITEMS);
  }

  if (aggregate.classification === AggregateClassification.PURCHASED) {
    if (aggregate.items.length > 0) {
      throw aggregateError(
        'A purchased aggregate has no composition.',
        AggregateErrorCode.PURCHASED_WITH_ITEMS,
      );
    }
    return;
  }

  if (aggregate.items.length === 0) {
    throw aggregateError(
      'A produced aggregate requires at least one item.',
      AggregateErrorCode.PRODUCED_WITHOUT_ITEMS,
    );
  }

  const seen = new Set();
  for (const item of aggregate.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw aggregateError(
        'Item quantity must be an integer greater than or equal to 1.',
        AggregateErrorCode.INVALID_QUANTITY,
      );
    }
    if (productId && item.productId === String(productId)) {
      throw aggregateError(
        'A product cannot be an item of itself.',
        AggregateErrorCode.SELF_REFERENCE,
      );
    }
    if (seen.has(item.productId)) {
      throw aggregateError(
        `The same item cannot occur more than once: ${item.productId}.`,
        AggregateErrorCode.DUPLICATE_ITEM,
      );
    }
    seen.add(item.productId);
  }
}

export function validateAggregateItems(items, itemProducts, pizzaProductIds = []) {
  const byId = new Map(itemProducts.map((p) => [String(p.id), p]));
  const pizzas = new Set(pizzaProductIds.map(String));

  for (const { productId } of items) {
    const product = byId.get(productId);
    if (!product) {
      throw aggregateError(`Item not found: ${productId}.`, AggregateErrorCode.ITEM_NOT_FOUND);
    }
    if (!product.isActive) {
      throw aggregateError(
        `Item must be active: ${product.name}.`,
        AggregateErrorCode.ITEM_INACTIVE,
      );
    }
    if (pizzas.has(productId)) {
      throw aggregateError(
        `A pizza cannot be an item: ${product.name}.`,
        AggregateErrorCode.ITEM_IS_PIZZA,
      );
    }
    if (product.isAggregate) {
      throw aggregateError(
        `An aggregate cannot contain another aggregate: ${product.name}.`,
        AggregateErrorCode.NESTED,
      );
    }
  }
}

export function validateAggregateOwner({ isPizza, isItemOfAggregate }) {
  if (isPizza) {
    throw aggregateError('A pizza cannot be an aggregate.', AggregateErrorCode.OWNER_IS_PIZZA);
  }
  if (isItemOfAggregate) {
    throw aggregateError(
      'The product is an item of another aggregate, so it cannot be an aggregate.',
      AggregateErrorCode.OWNER_IS_ITEM,
    );
  }
}
