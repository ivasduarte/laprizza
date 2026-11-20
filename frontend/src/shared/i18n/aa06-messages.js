/**
 * AA06 texts (user administration: accounts, roles and activation invitations), merged into
 * `messages` by message.js. Role names are keys sent by the back end.
 */
export const aa06Messages = {
  en: {
    nav: { users: 'Users' },
    users: {
      title: 'Users',
      intro:
        'Manage website accounts, their roles and their activation invitations. Changes to roles apply on the next request of the user.',
      infrastructureNote:
        'Website roles are independent of infrastructure administration (servers, deployment, backups).',
      you: 'This is your account (your own roles and status cannot be changed here).',
      noRoles: 'No roles',
      listTitle: 'Accounts',
      refresh: 'Refresh',
      retry: 'Try again',
      loading: 'Loading accounts…',
      empty: 'There are no accounts.',
      working: 'Working…',
      col: {
        account: 'Account',
        roles: 'Roles',
        status: 'Status',
        actions: 'Actions',
      },
      status: {
        active: 'Active',
        pending: 'Waiting for activation',
        disabled: 'Disabled',
        inactive: 'Inactive',
      },
      roleNames: {
        ADMINISTRATOR: 'Administrator',
        MANAGER: 'LaPrizza Manager',
        EMPLOYEE: 'Restaurant Staff',
        CUSTOMER: 'Customer',
      },
      create: {
        title: 'New account',
        intro:
          'The account is created inactive and an activation invitation is sent to its e-mail address. The user chooses the password when activating it.',
        email: 'E-mail',
        username: 'Username (optional)',
        roles: 'Roles',
        customerHint:
          'Every account also receives the Customer role automatically.',
        submit: 'Create and send invitation',
      },
      created: 'Account created.',
      invitationSent:
        'An activation invitation was sent to {{email}}. It expires on {{date}}.',
      invitationNotSent:
        'The invitation e-mail to {{email}} could not be sent. Send a new invitation.',
      chooseRole: 'Add a role…',
      addRole: 'Add',
      addRoleTo: 'Role to add to {{user}}',
      removeRoleFrom: 'Remove the role {{role}} from {{user}}',
      roleAdded: 'Role {{role}} assigned to {{user}}.',
      roleRemoved: 'Role {{role}} removed from {{user}}.',
      confirmRemoveRole:
        'Remove the role {{role}} from {{user}}? The user loses its permissions on the next request.',
      confirmDisable:
        'Disable {{user}}? The user is signed out and pending invitations stop working.',
      confirm: 'Confirm',
      cancel: 'Cancel',
      disable: 'Disable',
      enable: 'Enable',
      enabled: '{{user}} was enabled.',
      disabled: '{{user}} was disabled.',
      reissue: 'Send new invitation',
      showHistory: 'Role history',
      hideHistory: 'Hide history',
      history: {
        title: 'Role history',
        loading: 'Loading history…',
        empty: 'No role changes recorded.',
        when: 'When',
        change: 'Change',
        by: 'By',
        assigned: '{{role}} assigned',
        removed: '{{role}} removed',
        process: {
          'initial-customer-role': 'System (automatic Customer role)',
          'initial-account-seed': 'System (first account)',
          'migration-aa06': 'System (data migration)',
          'external-first-login': 'System (first external sign-in)',
        },
      },
      err: {
        network:
          'Could not reach the server. Check your connection and try again.',
        session: 'Your session has expired. Sign in again to continue.',
        forbidden: 'You do not have permission to do this.',
        self: 'You cannot change your own roles.',
        notAssignable: 'You are not allowed to assign this role.',
        notFound: 'This account no longer exists. Refresh the list.',
        invalid: 'The data is not valid.',
        duplicate: 'The e-mail or username is already in use.',
        activationRequired:
          'This account was never activated. Send a new invitation instead.',
        alreadyActivated:
          'This account is already activated: no invitation is needed.',
        disabled: 'This account is disabled. Enable it first.',
        emailMissing: 'This account has no e-mail address.',
        unavailable:
          'The change could not be recorded, so it was not applied. Try again in a moment.',
        generic: 'Something went wrong. Try again in a moment.',
        email: 'Enter a valid e-mail address.',
        username: 'Use 3 to 30 letters or numbers.',
      },
    },
  },
  pt: {
    nav: { users: 'Utilizadores' },
    users: {
      title: 'Utilizadores',
      intro:
        'Gerir as contas do website, as suas roles e os convites de ativação. As alterações de roles aplicam-se no pedido seguinte do utilizador.',
      infrastructureNote:
        'As roles do website são independentes da administração da infraestrutura (servidores, deploy, backups).',
      you: 'Esta é a sua conta (não pode alterar aqui as suas próprias roles nem o estado).',
      noRoles: 'Sem roles',
      listTitle: 'Contas',
      refresh: 'Atualizar',
      retry: 'Tentar novamente',
      loading: 'A carregar contas…',
      empty: 'Não existem contas.',
      working: 'A processar…',
      col: {
        account: 'Conta',
        roles: 'Roles',
        status: 'Estado',
        actions: 'Ações',
      },
      status: {
        active: 'Ativa',
        pending: 'A aguardar ativação',
        disabled: 'Desativada',
        inactive: 'Inativa',
      },
      roleNames: {
        ADMINISTRATOR: 'Administrador',
        MANAGER: 'Gestor LaPrizza',
        EMPLOYEE: 'Funcionário',
        CUSTOMER: 'Cliente',
      },
      create: {
        title: 'Nova conta',
        intro:
          'A conta é criada inativa e é enviado um convite de ativação para o seu email. O utilizador escolhe a password ao ativá-la.',
        email: 'Email',
        username: 'Nome de utilizador (opcional)',
        roles: 'Roles',
        customerHint:
          'Todas as contas recebem também a role Cliente automaticamente.',
        submit: 'Criar e enviar convite',
      },
      created: 'Conta criada.',
      invitationSent:
        'Foi enviado um convite de ativação para {{email}}. Expira em {{date}}.',
      invitationNotSent:
        'Não foi possível enviar o email do convite para {{email}}. Envie um novo convite.',
      chooseRole: 'Adicionar role…',
      addRole: 'Adicionar',
      addRoleTo: 'Role a adicionar a {{user}}',
      removeRoleFrom: 'Remover a role {{role}} de {{user}}',
      roleAdded: 'Role {{role}} atribuída a {{user}}.',
      roleRemoved: 'Role {{role}} removida de {{user}}.',
      confirmRemoveRole:
        'Remover a role {{role}} de {{user}}? O utilizador perde as permissões no pedido seguinte.',
      confirmDisable:
        'Desativar {{user}}? A sessão do utilizador termina e os convites pendentes deixam de funcionar.',
      confirm: 'Confirmar',
      cancel: 'Cancelar',
      disable: 'Desativar',
      enable: 'Ativar',
      enabled: '{{user}} foi ativado.',
      disabled: '{{user}} foi desativado.',
      reissue: 'Enviar novo convite',
      showHistory: 'Histórico de roles',
      hideHistory: 'Esconder histórico',
      history: {
        title: 'Histórico de roles',
        loading: 'A carregar histórico…',
        empty: 'Não há alterações de roles registadas.',
        when: 'Quando',
        change: 'Alteração',
        by: 'Por',
        assigned: '{{role}} atribuída',
        removed: '{{role}} removida',
        process: {
          'initial-customer-role': 'Sistema (role Cliente automática)',
          'initial-account-seed': 'Sistema (primeira conta)',
          'migration-aa06': 'Sistema (migração de dados)',
          'external-first-login': 'Sistema (primeiro login externo)',
        },
      },
      err: {
        network:
          'Não foi possível contactar o servidor. Verifique a ligação e tente novamente.',
        session: 'A sessão expirou. Inicie sessão novamente para continuar.',
        forbidden: 'Não tem permissão para fazer isto.',
        self: 'Não pode alterar as suas próprias roles.',
        notAssignable: 'Não tem permissão para atribuir esta role.',
        notFound: 'Esta conta já não existe. Atualize a lista.',
        invalid: 'Os dados não são válidos.',
        duplicate: 'O email ou o nome de utilizador já está em uso.',
        activationRequired:
          'Esta conta nunca foi ativada. Envie um novo convite em vez disso.',
        alreadyActivated: 'Esta conta já está ativada: não é preciso convite.',
        disabled: 'Esta conta está desativada. Ative-a primeiro.',
        emailMissing: 'Esta conta não tem endereço de email.',
        unavailable:
          'Não foi possível registar a alteração, por isso não foi aplicada. Tente novamente dentro de momentos.',
        generic: 'Algo correu mal. Tente novamente dentro de momentos.',
        email: 'Introduza um email válido.',
        username: 'Use 3 a 30 letras ou números.',
      },
    },
  },
};
