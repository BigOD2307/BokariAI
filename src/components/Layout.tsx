const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="bk-grid bk-grid-fade flex-1 flex flex-col h-full relative min-w-0">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[860px] lg:mx-auto mx-4">{children}</div>
      </div>
    </main>
  );
};

export default Layout;
