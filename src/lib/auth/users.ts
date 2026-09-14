export type UserGroup = 'hike' | 'default';

export type HardcodedUser = {
  id: string;
  username: string;
  password: string;
  userGroup: UserGroup;
};

export const HARDCODED_USERS: HardcodedUser[] = [
  { id: '1', username: 'default', password: 'default', userGroup: 'default' },
  { id: '2', username: 'hiker', password: 'hiker', userGroup: 'hike' },
];
