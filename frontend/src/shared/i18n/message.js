export const messages = {
  en: {
    layout: {
      skipToContent: 'Skip to main content',
      homeLink: 'LaPrizza - go to the home page',
      primaryNav: 'Primary navigation',
      loading: 'Loading...',
    },
    language: {
      label: 'Language',
    },
    nav: {
      home: 'Home',
      visualization3d: '3D Visualization',
      ai: 'AI',
      login: 'Login',
      changePassword: 'Change password',
      forgotPassword: 'Forgot password',
      resetPassword: 'Reset password',
    },
    home: {
      welcome: 'Welcome to LaPrizza',
      description: 'Restaurant information system.',
    },
    auth: {
      email: 'Email',
      password: 'Password',
      currentPassword: 'Current password',
      newPassword: 'New password',
      confirmPassword: 'Confirm new password',
      passwordRules:
        'Between 8 and 64 characters, with at least one uppercase letter and one of these symbols: ! @ # $ % ^ & * . , - _ ?',
      passwordsDiffer: 'The passwords do not match.',
      retryIn: 'Try again in {{minutes}} min.',
      backToLogin: 'Back to login',
      sessionExpired: 'Your session has ended. Please log in again.',
      loginTitle: 'Login',
      loginSubmit: 'Login',
      forgotLink: 'Forgot your password?',
      forgotTitle: 'Recover password',
      forgotIntro:
        'Enter the email of your account. If it exists, you will receive a link valid for 30 minutes.',
      forgotSubmit: 'Send link',
      forgotSent:
        'If an account with that email exists, a recovery link has been sent. Check your inbox.',
      resetTitle: 'Set a new password',
      resetSubmit: 'Save password',
      resetDone: 'Password changed. You can now log in with the new password.',
      resetMissingToken: 'Invalid recovery link. Request a new one.',
      changeTitle: 'Change password',
      changeSubmit: 'Change password',
      changeDone: 'Password changed. Sessions on other devices were ended.',
      signedInAs: 'Signed in as {{email}}.',
      sessionTitle: 'Session',
      logout: 'Logout',
      logoutAll: 'Logout on all devices',
      errors: {
        INVALID_CREDENTIALS: 'Incorrect email or password.',
        ACCOUNT_INACTIVE:
          'The account is not active yet. Use the activation invitation you received by email.',
        ACCOUNT_DISABLED:
          'The account is disabled. Contact the restaurant manager.',
        TOO_MANY_ATTEMPTS: 'Too many failed attempts.',
        RATE_LIMITED: 'Too many requests.',
        VALIDATION_FAILED: 'Please check the data you entered.',
        PASSWORD_POLICY_VIOLATION:
          'The new password does not meet the security rules.',
        CURRENT_PASSWORD_INCORRECT: 'The current password is incorrect.',
        RESET_TOKEN_INVALID:
          'The recovery link is invalid, was already used or has expired. Request a new one.',
        SESSION_REVOKED: 'Your session has ended. Please log in again.',
        REFRESH_INVALID: 'Your session has ended. Please log in again.',
        NETWORK_ERROR: 'Could not reach the server. Check your connection.',
        UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
      },
    },
    backend: {
      checking: 'Checking...',
      ok: 'Backend: OK',
      unreachable: 'Backend: unreachable',
    },
  },
  pt: {
    layout: {
      skipToContent: 'Saltar para o conteúdo principal',
      homeLink: 'LaPrizza - ir para a página inicial',
      primaryNav: 'Navegação principal',
      loading: 'A carregar...',
    },
    language: {
      label: 'Idioma',
    },
    nav: {
      home: 'Início',
      visualization3d: 'Visualização 3D',
      ai: 'IA',
      login: 'Iniciar sessão',
      changePassword: 'Alterar palavra-passe',
      forgotPassword: 'Recuperar palavra-passe',
      resetPassword: 'Redefinir palavra-passe',
    },
    home: {
      welcome: 'Bem-vindo à LaPrizza',
      description: 'Sistema de informação do restaurante.',
    },
    auth: {
      email: 'Email',
      password: 'Palavra-passe',
      currentPassword: 'Palavra-passe atual',
      newPassword: 'Nova palavra-passe',
      confirmPassword: 'Confirmar nova palavra-passe',
      passwordRules:
        'Entre 8 e 64 caracteres, com pelo menos uma letra maiúscula e um destes símbolos: ! @ # $ % ^ & * . , - _ ?',
      passwordsDiffer: 'As palavras-passe não coincidem.',
      retryIn: 'Tente novamente dentro de {{minutes}} min.',
      backToLogin: 'Voltar ao início de sessão',
      sessionExpired: 'A sua sessão terminou. Inicie sessão novamente.',
      loginTitle: 'Iniciar sessão',
      loginSubmit: 'Entrar',
      forgotLink: 'Esqueceu-se da palavra-passe?',
      forgotTitle: 'Recuperar palavra-passe',
      forgotIntro:
        'Indique o email da sua conta. Se existir, receberá um link válido durante 30 minutos.',
      forgotSubmit: 'Enviar link',
      forgotSent:
        'Se existir uma conta com esse email, foi enviado um link de recuperação. Verifique a sua caixa de correio.',
      resetTitle: 'Definir nova palavra-passe',
      resetSubmit: 'Guardar palavra-passe',
      resetDone:
        'Palavra-passe alterada. Já pode iniciar sessão com a nova palavra-passe.',
      resetMissingToken: 'Link de recuperação inválido. Peça um novo link.',
      changeTitle: 'Alterar palavra-passe',
      changeSubmit: 'Alterar palavra-passe',
      changeDone:
        'Palavra-passe alterada. As sessões noutros dispositivos foram terminadas.',
      signedInAs: 'Sessão iniciada como {{email}}.',
      sessionTitle: 'Sessão',
      logout: 'Terminar sessão',
      logoutAll: 'Terminar sessão em todos os dispositivos',
      errors: {
        INVALID_CREDENTIALS: 'Email ou palavra-passe incorretos.',
        ACCOUNT_INACTIVE:
          'A conta ainda não está ativa. Use o convite de ativação que recebeu por email.',
        ACCOUNT_DISABLED:
          'A conta está desativada. Contacte o gerente do restaurante.',
        TOO_MANY_ATTEMPTS: 'Demasiadas tentativas falhadas.',
        RATE_LIMITED: 'Demasiados pedidos.',
        VALIDATION_FAILED: 'Verifique os dados introduzidos.',
        PASSWORD_POLICY_VIOLATION:
          'A nova palavra-passe não cumpre as regras de segurança.',
        CURRENT_PASSWORD_INCORRECT: 'A palavra-passe atual está incorreta.',
        RESET_TOKEN_INVALID:
          'O link de recuperação é inválido, já foi usado ou expirou. Peça um novo link.',
        SESSION_REVOKED: 'A sua sessão terminou. Inicie sessão novamente.',
        REFRESH_INVALID: 'A sua sessão terminou. Inicie sessão novamente.',
        NETWORK_ERROR:
          'Não foi possível contactar o servidor. Verifique a ligação.',
        UNKNOWN_ERROR: 'Ocorreu um erro inesperado. Tente novamente.',
      },
    },
    backend: {
      checking: 'A verificar...',
      ok: 'Backend: OK',
      unreachable: 'Backend: inacessível',
    },
  },
};
