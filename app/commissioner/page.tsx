import { auth, signIn, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import { getStoredModifiers } from '@/lib/modifier-store';
import CommissionerControls from './CommissionerControls';

export default async function CommissionerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  const { error } = await searchParams;

  if (!session?.user) {
    return (
      <main className="commissioner-page">
        <a className="back-link" href="/">← Back to league board</a>
        <section className="commissioner-login">
          <span className="eyebrow">PRIVATE CONTROL ROOM</span>
          <h1>Commissioner access.</h1>
          <p>Enter the private commissioner password to manage global weekly modifiers and final score adjustments.</p>
          <form className="commissioner-form" action={async (formData) => { 'use server'; try { await signIn('credentials', { password: formData.get('password'), redirectTo: '/commissioner' }); } catch { redirect('/commissioner?error=invalid_password'); } }}><label htmlFor="password">COMMISSIONER PASSWORD</label><input id="password" name="password" type="password" required autoComplete="current-password" /><button className="primary-button" type="submit">Unlock controls <span>↗</span></button>{error === 'invalid_password' && <p className="login-error">Incorrect commissioner password.</p>}</form>
        </section>
      </main>
    );
  }

  const modifiers = await getStoredModifiers(2);

  return (
    <main className="commissioner-page">
      <div className="commissioner-top"><a className="back-link" href="/">← Back to league board</a><form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}><button className="text-button" type="submit">Sign out</button></form></div>
      <div className="matchup-page-header"><div><span className="eyebrow">PRIVATE CONTROL ROOM</span><h1>Commissioner desk.</h1></div><span className="status-pill dark-pill">PASSWORD ACCESS</span></div>
      <section className="control-section"><div className="section-heading"><div><span className="eyebrow">UPCOMING RULES / WEEK 02</span><h2>Global modifiers</h2></div><span className="lock-label">LOCKS SUNDAY / 8:00 PM ET</span></div><CommissionerControls initialModifiers={modifiers} /></section>
      <section className="control-section"><div className="section-heading"><div><span className="eyebrow">FINAL SCORE WORKFLOW</span><h2>Commissioner adjustments</h2></div></div><p className="page-note">Final adjustments will appear here after games are complete. Every saved change will retain its Week 1 modifier and calculation version.</p></section>
    </main>
  );
}
