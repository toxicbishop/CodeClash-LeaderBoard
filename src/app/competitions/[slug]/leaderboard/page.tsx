import { redirect } from 'next/navigation';

export const instant = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CompetitionLeaderboardPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/leaderboard?comp=${slug}`);
}
