export * from '../../application/identity/contracts/AbilityContracts';

export type UserProfileDTO = {
  id: string;
  email: string;
  username: string;
  level: number;
  role: { name: string } | null;
  isTotpEnabled: boolean;
  _count: { passkeys: number };
};

export type BookmarkDTO = {
  id: string;
  type: 'post' | 'comment';
  bookmarkedAt: Date;
  content?: string;
  title?: string;
  status?: string;
  author?: { id: string; username: string };
  category?: { id: string; name: string; description: string | null };
  post?: { id: string; title: string; status: string };
};

export type PasskeySummaryDTO = {
  id: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: Date;
};

export type SessionDTO = {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
};

export type PublicProfileDTO = {
  username: string;
  role: { name: string } | null;
  createdAt: Date;
  posts: {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
    category: { name: string };
  }[];
  _count: { posts: number };
};

export type PasskeyOptionDTO = {
  id: string;
  counter: bigint;
  publicKey: Uint8Array | Buffer;
};

export type PasskeyDTO = {
  id: string;
  publicKey: Uint8Array | Buffer;
  userId: string;
  webAuthnUserID: string;
  counter: bigint;
  deviceType: string;
  backedUp: boolean;
  createdAt: Date;
};

export type UserWithRoleDTO = {
  id: string;
  email: string;
  username: string;
  status: string;
  level: number;
  roleId: string | null;
  isTotpEnabled: boolean;
  totpSecret: string | null;
  isPasskeyMandatory: boolean;
  createdAt: Date;
  updatedAt: Date;
  role: {
    id: string;
    name: string;
  } | null;
};

export type UserForLoginDTO = UserWithRoleDTO & {
  passkeys: PasskeyDTO[];
};

export type UserDTO = {
  id: string;
  email: string;
  username: string;
  status: string;
  level: number;
  roleId: string | null;
  isTotpEnabled: boolean;
  totpSecret: string | null;
  isPasskeyMandatory: boolean;
  createdAt: Date;
  updatedAt: Date;
};
