export type ModerationPost = { id: string; title: string; content: string; author?: { username?: string }; category?: { name?: string } };
export type ModerationComment = { id: string; content: string; author?: { username?: string }; post?: { title?: string } };
export type ModerationWord = { id: string; word: string; categoryId?: string | null; category?: { name?: string } };

export type RecyclePost = { id: string; title: string; author?: { username?: string }; category?: { name?: string } };
export type RecycleComment = { id: string; content: string; author?: { username?: string }; post?: { title?: string } };
