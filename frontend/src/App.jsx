import { useState, useEffect } from 'react';

export default function App() {
  const [repoPath, setRepoPath] = useState('');
  const [query, setQuery] = useState('');
  const [containerTag, setContainerTag] = useState('default_repo');
  
  // States for indexing
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexStats, setIndexStats] = useState(null);
  const [indexError, setIndexError] = useState(null);
  
  // States for search
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);

  // Status check for backend
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    // Check backend health on mount
    fetch('http://localhost:3000/health')
      .then((res) => {
        if (res.ok) setBackendStatus('connected');
        else setBackendStatus('error');
      })
      .catch(() => setBackendStatus('offline'));
  }, []);

  const handleIndexRepo = async (e) => {
    e.preventDefault();
    if (!repoPath) return;

    setIsIndexing(true);
    setIndexStats(null);
    setIndexError(null);

    try {
      const response = await fetch('http://localhost:3000/api/index-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath, containerTag }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to index codebase');
      }

      setIndexStats(data.statistics);
    } catch (err) {
      setIndexError(err.message);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, containerTag }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search request failed');
      }

      setSearchResults(data.results || []);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Quick query suggestions
  const suggestions = [
    'Where is the main entry point of the project?',
    'Find configuration schemas or env variables',
    'How does routing or API controllers work?',
    'Show me the authentication helper logic',
  ];

  return (
    <div className="min-h-screen bg-bg-dark text-text-primary flex flex-col antialiased selection:bg-primary/30 selection:text-primary-hover">
      
      {/* Top Banner Navigation */}
      <header className="border-b border-border-dark bg-surface-dark/40 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center font-bold text-white shadow-md shadow-primary/20">
            Ω
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight m-0 leading-none">
              Zero-Cloud
            </h1>
            <span className="text-[10px] text-color-text-secondary uppercase tracking-widest font-mono">
              Codebase Onboarding Agent
            </span>
          </div>
        </div>

        {/* Server status indicator badges */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-mono bg-border-dark/50 px-3 py-1.5 rounded-full border border-border-dark">
            <span className="text-color-text-secondary">Backend:</span>
            {backendStatus === 'connected' && (
              <span className="flex items-center gap-1.5 text-green-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                Localhost:3000
              </span>
            )}
            {backendStatus === 'offline' && (
              <span className="flex items-center gap-1.5 text-red-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                Disconnected
              </span>
            )}
            {backendStatus === 'checking' && (
              <span className="text-yellow-400">Checking...</span>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Left Side Panel: Ingestion Control */}
        <section className="lg:col-span-1 bg-surface-dark border border-border-dark rounded-xl p-5 shadow-xl flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-color-text-secondary">
              1. Index Repository
            </h2>
            <p className="text-xs text-color-text-secondary mt-1">
              Supply a local folder path to chunk and load into your offline search engine.
            </p>
          </div>

          <form onSubmit={handleIndexRepo} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="repoPath" className="text-xs font-mono text-color-text-secondary">
                Absolute Folder Path:
              </label>
              <input
                id="repoPath"
                type="text"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="e.g. C:\projects\my-app"
                disabled={isIndexing}
                className="w-full bg-bg-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="containerTag" className="text-xs font-mono text-color-text-secondary">
                Container Tag (Isolation Boundary):
              </label>
              <input
                id="containerTag"
                type="text"
                value={containerTag}
                onChange={(e) => setContainerTag(e.target.value)}
                placeholder="e.g. my_project_tag"
                disabled={isIndexing}
                className="w-full bg-bg-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isIndexing || !repoPath}
              className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isIndexing
                  ? 'bg-purple-950/40 text-primary-hover border border-primary/30'
                  : 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isIndexing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-primary-hover" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Indexing Codebase...
                </>
              ) : (
                'Index Directory'
              )}
            </button>
          </form>

          {/* Indexing Stats / Progress Display */}
          {isIndexing && (
            <div className="bg-bg-dark border border-border-dark rounded-lg p-3.5 flex flex-col gap-2 font-mono text-[11px] text-color-text-secondary">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                Crawling filesystem...
              </span>
              <span>Running code chunking window...</span>
              <span>Writing local SQLite vectors...</span>
            </div>
          )}

          {indexStats && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-col gap-2.5 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary-hover">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Indexing Complete
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono border-t border-border-dark/60 pt-2 text-color-text-secondary">
                <span>Files Indexed:</span>
                <span className="text-right text-text-primary font-bold">{indexStats.filesScanned}</span>
                <span>Chunks Written:</span>
                <span className="text-right text-text-primary font-bold">{indexStats.chunksIndexed}</span>
              </div>
            </div>
          )}

          {indexError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-xs text-red-400 animate-fade-in">
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                Indexing Error
              </div>
              <p className="font-mono text-[11px] leading-relaxed break-all">{indexError}</p>
            </div>
          )}
        </section>

        {/* Right Side Panel: Main Search & Code Browsing Console */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Command Palette Focus Input Box */}
          <div className="bg-surface-dark border border-border-dark rounded-xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
            
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a question about the repository (e.g. 'How does authentication work?')"
                  disabled={isSearching}
                  className="w-full bg-bg-dark border border-border-dark rounded-lg pl-11 pr-14 py-3.5 text-base text-text-primary focus:outline-none focus:border-primary transition-all placeholder:text-zinc-600 focus:shadow-[0_0_15px_rgba(168,85,247,0.15)] disabled:opacity-50"
                />
                
                {/* Left search icon */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
                
                {/* Right shortcut hint */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-zinc-600 bg-border-dark px-1.5 py-0.5 rounded border border-border-dark">
                  <span>Enter</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="bg-primary hover:bg-primary-hover text-white px-6 rounded-lg font-semibold flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {/* In-palette suggestion quick clicks */}
            <div className="mt-4 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mr-1">Suggestions:</span>
              {suggestions.map((text, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(text);
                  }}
                  className="text-xs bg-bg-dark hover:bg-border-dark/30 border border-border-dark px-2.5 py-1 rounded-full text-color-text-secondary cursor-pointer transition-colors"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          {/* Search Output Section */}
          <div className="flex flex-col gap-4">
            
            {/* Header info bar */}
            {searchResults.length > 0 && (
              <div className="flex justify-between items-center px-2">
                <span className="text-xs text-color-text-secondary font-mono">
                  Showing {searchResults.length} relevant semantic matches
                </span>
                <button
                  onClick={() => setSearchResults([])}
                  className="text-xs text-zinc-500 hover:text-text-primary cursor-pointer transition-colors"
                >
                  Clear Results
                </button>
              </div>
            )}

            {/* Error alerts */}
            {searchError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-sm text-red-400 flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div className="font-mono text-xs leading-relaxed">{searchError}</div>
              </div>
            )}

            {/* Loading placeholder cards */}
            {isSearching && (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-surface-dark border border-border-dark rounded-xl p-5 shadow-md flex flex-col gap-3 animate-pulse">
                    <div className="flex justify-between items-center">
                      <div className="w-1/3 h-5 bg-border-dark rounded"></div>
                      <div className="w-16 h-5 bg-border-dark rounded-full"></div>
                    </div>
                    <div className="w-full h-24 bg-border-dark rounded-lg"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty view suggestion state */}
            {!isSearching && searchResults.length === 0 && (
              <div className="bg-surface-dark/40 border border-dashed border-border-dark rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full border border-border-dark flex items-center justify-center text-zinc-600 mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-text-primary">No codebase queries loaded</h3>
                <p className="text-xs text-color-text-secondary max-w-sm leading-relaxed">
                  Supply your codebase to the local indexer on the left, then run queries inside the search bar above to fetch code snippets.
                </p>
              </div>
            )}

            {/* Search results output renderer */}
            {!isSearching && searchResults.map((result, idx) => (
              <article
                key={idx}
                className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden shadow-md hover:border-primary/40 transition-all duration-200 animate-fade-in"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* Result header info */}
                <div className="bg-surface-dark/80 px-5 py-3 border-b border-border-dark flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-3">
                    {/* File path badge */}
                    <span className="px-2.5 py-1 rounded bg-bg-dark border border-border-dark text-xs font-mono font-medium text-text-primary select-all">
                      {result.filePath}
                    </span>
                    
                    {/* Line counts */}
                    <span className="text-[11px] font-mono text-zinc-500">
                      Lines {result.lineStart}-{result.lineEnd}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Language tag */}
                    <span className="px-2 py-0.5 rounded-full bg-border-dark/60 border border-border-dark text-[10px] font-mono uppercase text-color-text-secondary">
                      {result.language}
                    </span>

                    {/* Match confidence score */}
                    <span className="text-[11px] font-mono font-semibold text-primary-hover">
                      {(result.score * 100).toFixed(0)}% Match
                    </span>
                  </div>
                </div>

                {/* Preformatted code snippet content */}
                <div className="p-4 bg-bg-dark overflow-x-auto text-[13px] font-mono leading-relaxed max-h-[450px]">
                  <pre className="m-0 select-text">
                    <code className="text-zinc-300 block p-1 font-mono whitespace-pre">{result.content}</code>
                  </pre>
                </div>
              </article>
            ))}

          </div>
        </section>
      </main>

      {/* Localhost legal disclaimer footer */}
      <footer className="mt-auto border-t border-border-dark bg-bg-dark px-6 py-4 flex flex-wrap justify-between items-center gap-2">
        <span className="text-xs text-zinc-600 font-mono">
          Powered by local embedding binary · 100% Offline
        </span>
        <span className="text-xs text-zinc-600 font-mono">
          © {new Date().getFullYear()} Zero-Cloud Agent
        </span>
      </footer>
    </div>
  );
}
