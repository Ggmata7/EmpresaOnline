export default function Loading() {
  return <main className="min-h-screen bg-[#fbfcf7]" aria-label="Carregando ofertas">
    <div className="h-24 animate-pulse bg-[#e1eadd]" />
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 h-80 animate-pulse rounded-3xl bg-[#e8eee3]" />
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="hidden h-96 animate-pulse rounded-xl bg-white lg:block" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
        </div>
      </div>
    </div>
  </main>;
}
