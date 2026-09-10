export type UserGroup = 'hike' | 'research';

export type HardcodedUser = {
  id: string;
  username: string;
  password: string;
  userGroup: UserGroup;
};

export const HARDCODED_USERS: HardcodedUser[] = [
  { id: '1', username: 'hiker', password: 'hiker', userGroup: 'hike' },
  { id: '2', username: 'researcher', password: 'researcher', userGroup: 'research' },
];
