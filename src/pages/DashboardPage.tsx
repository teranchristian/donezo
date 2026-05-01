import { useEffect, useState } from 'react';
import { DashboardHeader } from '../components/DashboardHeader';
import { GitHubCard } from '../components/GitHubCard';
import { HeaderMenu } from '../components/HeaderMenu';
import { JiraCard } from '../components/JiraCard';
import { NotesCard } from '../components/NotesCard';
import { PlaceholderCard } from '../components/PlaceholderCard';
import { SummaryCard } from '../components/SummaryCard';
import { GitHubDashboardData } from '../lib/githubApi';
import { JiraDashboardData } from '../lib/jiraApi';
import {
  DashboardSettings,
  getStoredActiveIntegration,
  saveStoredActiveIntegration,
  type ActiveIntegration
} from '../lib/storage';

type DashboardPageProps = {
  settings: DashboardSettings;
  gitHubData: GitHubDashboardData;
  gitHubSummary: string;
  isGitHubLoading: boolean;
  isCheckingGitHubActivity: boolean;
  lastGitHubActivityCheckAt: number | null;
  onRefreshGitHub: () => void;
  jiraData: JiraDashboardData;
  isJiraLoading: boolean;
  onRefreshJira: () => void;
};

export function DashboardPage({
  settings,
  gitHubData,
  gitHubSummary,
  isGitHubLoading,
  isCheckingGitHubActivity,
  lastGitHubActivityCheckAt,
  onRefreshGitHub,
  jiraData,
  isJiraLoading,
  onRefreshJira
}: DashboardPageProps) {
  const [activeIntegration, setActiveIntegration] = useState<ActiveIntegration>('github');
  const [hasLoadedActiveIntegration, setHasLoadedActiveIntegration] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getStoredActiveIntegration().then((storedActiveIntegration) => {
      if (!isMounted) {
        return;
      }

      setActiveIntegration(storedActiveIntegration);
      setHasLoadedActiveIntegration(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedActiveIntegration) {
      return;
    }

    void saveStoredActiveIntegration(activeIntegration);
  }, [activeIntegration, hasLoadedActiveIntegration]);

  return (
    <main className="min-h-screen bg-page-glow px-5 py-6 text-stone-100 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <DashboardHeader name={settings.name} />
          <HeaderMenu />
        </div>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <section className="flex flex-col gap-6">
            <SummaryCard summary={gitHubSummary} />
            <NotesCard />
            <PlaceholderCard
              title="Calendar"
              subtitle="Placeholder"
              description="Upcoming meetings and focus blocks will fit here once calendar integration is added."
              className="min-h-[220px]"
            />
            <PlaceholderCard
              title="Workspace"
              subtitle="Later"
              description="This area can hold quick links, streaks, or a small pomodoro widget when you want to expand the dashboard."
              className="min-h-[220px]"
            />
          </section>

          <section className="flex min-h-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-white/5 bg-panel/95 p-3 shadow-panel backdrop-blur-sm">
              <IntegrationTabButton
                label="GitHub"
                isActive={activeIntegration === 'github'}
                onClick={() => setActiveIntegration('github')}
              />
              <IntegrationTabButton
                label="Jira"
                isActive={activeIntegration === 'jira'}
                onClick={() => setActiveIntegration('jira')}
              />
            </div>

            <div className="flex min-h-0 flex-1">
              {activeIntegration === 'github' ? (
                <GitHubCard
                  data={gitHubData}
                  username={settings.integrations.github.username}
                  token={settings.integrations.github.token}
                  isLoading={isGitHubLoading}
                  isCheckingActivity={isCheckingGitHubActivity}
                  lastActivityCheckAt={lastGitHubActivityCheckAt}
                  onRefresh={onRefreshGitHub}
                />
              ) : (
                <JiraCard
                  baseUrl={settings.integrations.jira.baseUrl}
                  data={jiraData}
                  isLoading={isJiraLoading}
                  onRefresh={onRefreshJira}
                />
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function IntegrationTabButton({
  label,
  isActive,
  onClick
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        isActive
          ? 'border-white/20 bg-white/10 text-stone-100'
          : 'border-white/8 bg-black/10 text-stone-400 hover:border-white/15 hover:bg-black/20 hover:text-stone-200'
      }`}
    >
      {label}
    </button>
  );
}
