/**
 * AA02 texts (contact phone after the first external login), the shared JSON editor (WEB04)
 * and the breadcrumbs (WEB02), merged into `messages` by message.js.
 */
export const aa02Messages = {
  en: {
    json: { errorOnLine: 'This line has an error' },
    breadcrumbs: { label: 'Breadcrumb', new: 'New', detail: 'Detail', edit: 'Edit' },
    nav: { completeProfile: 'Complete profile' },
    profile: {
      phone: {
        title: 'Complete your profile',
        intro:
          'Your account was created with your external provider, which did not share a phone number. Add one to use the customer features.',
        label: 'Phone number',
        hint: 'Portuguese number, e.g. 912 345 678 or +351 212 345 678.',
        submit: 'Save and continue',
      },
    },
  },
  pt: {
    json: { errorOnLine: 'Esta linha tem um erro' },
    breadcrumbs: {
      label: 'Localização',
      new: 'Novo',
      detail: 'Detalhe',
      edit: 'Editar',
    },
    nav: { completeProfile: 'Completar perfil' },
    profile: {
      phone: {
        title: 'Complete o seu perfil',
        intro:
          'A sua conta foi criada com o fornecedor externo, que não partilhou o número de telefone. Indique-o para utilizar as funcionalidades de cliente.',
        label: 'Telefone',
        hint: 'Número português, p. ex. 912 345 678 ou +351 212 345 678.',
        submit: 'Guardar e continuar',
      },
    },
  },
};
