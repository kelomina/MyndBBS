export interface JwtPayload {
  userId: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
  }
}

export interface RegisterRequest {
  email: string;
  username: string;
  passwordHash?: string; // Optional only for pure passwordless accounts (future-proofing)
  captchaToken: string;
  supportsWebAuthn: boolean;
}
