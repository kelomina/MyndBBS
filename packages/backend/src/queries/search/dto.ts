import { PostListItemDTO } from '../community/dto';

export type UserListItemDTO = {
  id: string;
  username: string;
  level: number;
};

export type GlobalSearchResultDTO = {
  posts: PostListItemDTO[];
  users: UserListItemDTO[];
};
