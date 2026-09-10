import type { UserGroup } from '@/lib/auth/users';
import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      userGroup: UserGroup;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    userGroup: UserGroup;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    userGroup: UserGroup;
  }
}