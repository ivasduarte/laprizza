export function getAllergenErrorKey(action, error) {
    if (!error || error.global) return null;
    if (error.status === 404) return 'allergens.errors.notFound';
    if (error.status === 409) {
        return action === 'deactivate'
            ? 'allergens.errors.inUse'
            : 'allergens.errors.duplicate';
    } 
    return null;
}