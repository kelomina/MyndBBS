export interface IModeratorReadModel {
  listUserIdsByLevel(minLevel: number): Promise<{ id: string }[]>;
}
