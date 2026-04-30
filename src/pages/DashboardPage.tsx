import { DashboardHeader } from '../components/DashboardHeader';
import { GitHubCard } from '../components/GitHubCard';
import { HeaderMenu } from '../components/HeaderMenu';
import { NotesCard } from '../components/NotesCard';
import { PlaceholderCard } from '../components/PlaceholderCard';
import { SummaryCard } from '../components/SummaryCard';
import { GitHubDashboardData } from '../lib/githubApi';
import { DashboardSettings } from '../lib/storage';

type DashboardPageProps = {
  settings: DashboardSettings;
  gitHubData: GitHubDashboardData;
  gitHubSummary: string;
  isGitHubLoading: boolean;
  onRefreshGitHub: () => void;
};

export function DashboardPage({
  settings,
  gitHubData,
  gitHubSummary,
  isGitHubLoading,
  onRefreshGitHub
}: DashboardPageProps) {
  return (
    <main className="min-h-screen bg-page-glow px-5 py-6 text-stone-100 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <DashboardHeader name={settings.name} />
          <HeaderMenu />
        </div>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="flex flex-col gap-6">
            <SummaryCard summary={gitHubSummary} />
            <NotesCard />
          </section>

          <section className="flex min-h-0">
            <GitHubCard
              data={gitHubData}
              username={settings.integrations.github.username}
              token={settings.integrations.github.token}
              isLoading={isGitHubLoading}
              onRefresh={onRefreshGitHub}
            />
          </section>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <PlaceholderCard
            title="Calendar"
            subtitle="Placeholder"
            description="Upcoming meetings and focus blocks will fit here once calendar integration is added."
            className="min-h-[220px]"
          />
          <PlaceholderCard
            title="Jira"
            subtitle="Placeholder"
            description="Ticket status, blockers, and sprint priorities can be added without changing the layout."
            className="min-h-[220px]"
          />
          <PlaceholderCard
            title="Workspace"
            subtitle="Later"
            description="This area can hold quick links, streaks, or a small pomodoro widget when you want to expand the dashboard."
            className="min-h-[220px]"
          />
        </section>
      </div>
    </main>
  );
}
