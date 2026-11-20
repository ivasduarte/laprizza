export function getProductCategoryErrorKey(action, error) {
    if (!error || error.global) return null;
    if (error.status === 404) return 'productCategories.errors.notFound';
    if (error.status === 409) {
        return action === 'remove'
            ? 'productCategories.errors.inUse'
            : 'productCategories.errors.duplicate';
    }
    return null;
}