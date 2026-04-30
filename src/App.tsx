import { DashboardHeader } from './components/DashboardHeader';
import { NotesCard } from './components/NotesCard';
import { PlaceholderCard } from './components/PlaceholderCard';
import { SummaryCard } from './components/SummaryCard';

export default function App() {
  return (
    <main className="min-h-screen bg-page-glow px-5 py-6 text-stone-100 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <DashboardHeader name="Christian" />

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-6">
            <SummaryCard />

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <NotesCard />
              <div className="grid gap-6">
                <PlaceholderCard
                  title="GitHub"
                  subtitle="Placeholder"
                  description="Open pull requests, review requests, and branch health can land here next."
                />
                <PlaceholderCard
                  title="Jira"
                  subtitle="Placeholder"
                  description="Ticket status, blockers, and sprint priorities can be added without changing the layout."
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6">
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
          </div>
        </section>
      </div>
    </main>
  );
}
