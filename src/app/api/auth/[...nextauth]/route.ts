import NextAuth, { User, type AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { HARDCODED_USERS } from '@/lib/auth/users';
import { JWT } from 'next-auth/jwt';
import { ONE_DAY_IN_SEC } from '@/constants';

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'jsmith' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) return null;

        const foundUser = HARDCODED_USERS.find(
          (userRecord) =>
            userRecord.username === credentials.username && userRecord.password === credentials.password,
        );

        if (foundUser) {
          return { id: foundUser.id, username: foundUser.username, userGroup: foundUser.userGroup };
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: ONE_DAY_IN_SEC,
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }: { token: JWT; user: User }) {
      if (user) {
        token.userGroup = user.userGroup;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.userGroup = token.userGroup;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
