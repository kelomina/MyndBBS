export type RouteWhitelistDTO = {
  id: string;
  path: string;
  isPrefix: boolean;
  minRole: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};
