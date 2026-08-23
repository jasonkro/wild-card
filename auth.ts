import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Credentials({
    credentials: { password: { label: 'Commissioner password', type: 'password' } },
    async authorize(credentials) {
      if (!process.env.COMMISSIONER_PASSWORD || credentials?.password !== process.env.COMMISSIONER_PASSWORD) return null;
      return { id: 'commissioner', name: 'Commissioner' };
    },
  })],
  pages: { signIn: '/commissioner' },
});
