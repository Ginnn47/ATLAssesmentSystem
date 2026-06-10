import Sidebar from "./sidebar";

export default function SectionPage({ title, badge, description }) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto max-w-6xl rounded-3xl border-2 border-stone-200/90 bg-white p-8 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-label text-[10px] uppercase tracking-[0.22em] text-primary">
              {badge}
            </span>
            <h1 className="mt-4 font-headline text-3xl font-semibold tracking-tight text-stone-900">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
              {description}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
