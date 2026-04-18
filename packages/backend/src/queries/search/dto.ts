import { PostListItemDTO } from '../community/dto';
import { UserStatus } from '@myndbbs/shared';

export type UserListItemDTO = {
  id: string;
  username: string;
  status: UserStatus;
  level: number;
  createdAt: Date;
};

export type GlobalSearchResultDTO = {
  posts: PostListItemDTO[];
  users: UserListItemDTO[];
};
