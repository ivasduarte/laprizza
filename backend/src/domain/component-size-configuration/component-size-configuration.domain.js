import { DomainError } from '../domain-error.js';

/**
 * Checks if a product is a Pizza Component.
 *
 * @param {Object} product - The product to check.
 * @returns {boolean} True if the product is a pizza component, false otherwise.
 */
export function isPizzaComponent(product) {
  return product?.pizzaComponentTypeId != null;
}

/**
 * Finds the size configuration of a product for a pizza size.
 * A product has at most one configuration per pizza size, so the pizza identifies it within the product.
 *
 * @param {Object} product - The product that owns the configurations.
 * @param {string} pizzaSizeId - The id of the pizza size.
 * @returns {Object|null} The configuration for that pizza size, or null if there is none.
 */
export function findSizeConfiguration(product, pizzaSizeId) {
  return (
    product?.sizeConfigurations?.find(
      (configuration) => String(configuration.pizzaSizeId) === String(pizzaSizeId),
    ) ?? null
  );
}

/**
 * Ensures that only products designated as Pizza Components have size configurations.
 *
 * @param {Object} product - That product that would own the size configuration.
 * @throws {DomainError} If the product is not a Pizza Component.
 */
export function validateProductIsPizzaComponent(product) {
  if (!isPizzaComponent(product)) {
    throw new DomainError(
      'Invalid Component Size Configuration: Product is not a pizza component.',
    );
  }
}

/**
 * Normalizes the stock units consumed: an omitted value means "not defined" (null).
 * Any other value returns unchanged.
 *
 * @param {*} stockUnitsConsumed - The value received (number, null or undefined).
 * @returns {*} The same value, or null if it was undefined.
 */
export function normalizeStockUnitsConsumed(stockUnitsConsumed) {
  return stockUnitsConsumed === undefined ? null : stockUnitsConsumed;
}

/**
 * Validates the abstract stock units consumed against the stock control of the product.
 *
 * @param {boolean} stockControlled - Whether the product is stock controlled or not.
 * @param {*} stockUnitsConsumed - The value to validate, already normalized.
 * @throws {DomainError} If the value does not satisfy the rule for the product.
 */
export function validateStockUnitsConsumed(stockControlled, stockUnitsConsumed) {
  if (stockControlled) {
    if (!Number.isInteger(stockUnitsConsumed) || stockUnitsConsumed < 1) {
      throw new DomainError(
        'Invalid Stock Units Consumed: Stock controlled products must define it as an integer greater than or equal to 1.',
      );
    }
    return;
  }

  if (stockUnitsConsumed !== null) {
    throw new DomainError(
      'Invalid Stock Units Consumed: Only stock controlled products can define it.',
    );
  }
}

/**
 * Validates the reference to the pizza size received for a new configuration.
 * Must be a non-blank string; whether the size exists is checked by the service.
 *
 * @param {*} pizzaSizeId - The id of the pizza size to validate.
 * @throws {DomainError} If the id is missing, blank or not a string.
 */
export function validatePizzaSizeId(pizzaSizeId) {
  if (typeof pizzaSizeId !== 'string' || pizzaSizeId.trim().length === 0) {
    throw new DomainError('Invalid Pizza Size: Pizza Size is required.');
  }
}

/**
 * Validates the price applicable to the component when used in a pizza of the corresponding size.
 * It must be a finite number, greater than or equal to zero.
 *
 * @param {*} price - The price to validate.
 * @throws {DomainError} If the price is not a finite number or is negative.
 */
export function validatePrice(price) {
  if (typeof price !== 'number' || price < 0 || !Number.isFinite(price)) {
    throw new DomainError('Invalid Price: Price must be a number greater than or equal to 0.');
  }
}
