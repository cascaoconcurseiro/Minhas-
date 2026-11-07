export function getFirebaseAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Este método de acesso está desativado no Firebase. Habilite E-mail/senha nas configurações de autenticação.';
    case 'auth/unauthorized-domain':
      return 'Este endereço do app não está autorizado no Firebase Authentication.';
    case 'auth/invalid-email':
      return 'Informe um endereço de e-mail válido.';
    case 'auth/weak-password':
      return 'Escolha uma senha mais forte.';
    case 'auth/network-request-failed':
      return 'Não foi possível conectar ao serviço de autenticação. Verifique sua conexão e tente novamente.';
    case 'auth/email-already-in-use':
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    default:
      return 'Não foi possível autenticar. Verifique suas credenciais ou tente novamente.';
  }
}
