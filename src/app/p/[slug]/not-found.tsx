export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-light-primary dark:bg-dark-primary">
      <div className="text-center max-w-md px-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-bokari-400 to-bokari-600 flex items-center justify-center mb-6 shadow-lg shadow-bokari-500/20">
          <span className="text-white text-2xl font-bold" style={{ fontFamily: 'Instrument Serif, serif' }}>B</span>
        </div>
        <h1
          className="text-3xl text-black/90 dark:text-white/90 mb-2 tracking-tight"
          style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
        >
          Cette page n&apos;existe pas
        </h1>
        <p className="text-[14px] text-black/50 dark:text-white/45 mb-6">
          Le lien de partage est invalide, expire, ou a ete revoque par son proprietaire.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 py-3 px-6 rounded-xl text-[14px] font-medium bg-bokari-500 text-white hover:bg-bokari-600 transition-all"
        >
          Retour a Bokari
        </a>
      </div>
    </main>
  );
}
