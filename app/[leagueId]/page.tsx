import { redirect } from 'next/navigation';

export default async function LeagueShortcutPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;

  if (!/^\d{6,}$/.test(leagueId)) {
    redirect('/');
  }

  redirect(`/leagues/${leagueId}`);
}
