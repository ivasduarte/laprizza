import { getGetCustomersQueryOptions } from '../../api/generated/default/default';

export function getCustomerErrorKey(action, error) {
  if (!error || error.global) return null;
  if (error.status === 404) return 'customers.errors.notFound';
  if (action !== 'save' && error.status === 409) {
    return 'customers.errors.conflict';
  }
  return null;
}

export async function customerFieldErrors(queryClient, error, data, currentId) {
  if (error.status === 400 && error.fieldErrors.length === 0) {
    const mismatch = { type: 'customer.postalCodeCity' };
    return { 'address.postalCode': mismatch, 'address.city': mismatch };
  }
  if (error.status !== 409) return null;

  let matches;
  try {
    matches = await queryClient.fetchQuery({
      ...getGetCustomersQueryOptions({ search: data.email }),
      staleTime: 0,
    });
  } catch {
    // Without the search the cause stays unknown: both fields are marked.
    const taken = { type: 'customer.contactTaken' };
    return { email: taken, phoneNumber: taken };
  }
  const email = data.email.toLowerCase();
  const emailTaken = matches.some(
    (customer) =>
      customer.id !== currentId && customer.email?.toLowerCase() === email
  );
  return emailTaken
    ? { email: { type: 'customer.emailTaken' } }
    : { phoneNumber: { type: 'customer.phoneTaken' } };
}
