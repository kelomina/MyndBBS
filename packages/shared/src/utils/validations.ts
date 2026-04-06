// Minimum 8 characters, at least one uppercase, one lowercase, one number and one special character
export const STRICT_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const isValidPassword = (password: string): boolean => {
  return STRICT_PASSWORD_REGEX.test(password);
};
