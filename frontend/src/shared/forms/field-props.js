/**
 * Accessibility attributes that bind an input to its error text.
 * `<input {...fieldProps('name', errors, idFor)} />` + `<FieldError id={errorIdFor('name')} ... />`
 */
export const makeIdFor = (formId) => (field) =>
  `${formId}-${field.replaceAll('.', '-')}`;

export function fieldProps(field, errors, idFor) {
  const id = idFor(field);
  const invalid = Boolean(errors[field]);
  return {
    id,
    'aria-invalid': invalid ? 'true' : undefined,
    'aria-describedby': invalid ? `${id}-error` : undefined,
  };
}
