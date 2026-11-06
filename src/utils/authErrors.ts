export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message && error.message.length < 180) {
    return error.message;
  }
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  switch (code) {
    case 'EMAIL_PASSWORD_DISABLED':
      return 'Este método de acesso está desativado no Neon Auth.';
    case 'ORIGIN_NOT_ALLOWED':
      return 'Este endereço do app não está autorizado no Neon Auth.';
    case 'INVALID_EMAIL':
      return 'Informe um endereço de e-mail válido.';
    case 'WEAK_PASSWORD':
      return 'Escolha uma senha mais forte.';
    case 'NETWORK_ERROR':
      return 'Não foi possível conectar ao serviço de autenticação. Verifique sua conexão e tente novamente.';
    case 'USER_ALREADY_EXISTS':
    case 'INVALID_CREDENTIALS':
    case 'USER_NOT_FOUND':
    case 'INVALID_PASSWORD':
    default:
      return 'Não foi possível autenticar. Verifique suas credenciais ou tente novamente.';
  }
}
