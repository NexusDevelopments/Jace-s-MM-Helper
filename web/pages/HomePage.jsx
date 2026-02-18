import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function HomePage() {
  const [loading, setLoading] = useState(true);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // Simulate brief loading for consistent UX
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showAnnouncement) return;

    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, 10 - elapsed);
      setCountdown(remaining);

      if (remaining <= 0) {
        setShowAnnouncement(false);
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [showAnnouncement]);

  if (loading) {
    return (
      <>
        <div className="animated-bg"></div>
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <div>Loading...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="animated-bg"></div>
      <div className="background-bubbles">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="bubble" style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * -20}s`,
            animationDuration: `${14 + Math.random() * 10}s`
          }}></div>
        ))}
      </div>
      <div className="grid-lines"></div>

      {showAnnouncement && (
        <div className="rebrand-overlay">
          <div className="rebrand-card">
            <h2>There will be a Full Rebrand making this a global bot.</h2>
            <p>Launching Securify global mode in {countdown}s</p>
            <div className="rebrand-progress">
              <div className="rebrand-progress-fill" style={{ width: `${(countdown / 10) * 100}%` }}></div>
            </div>
          </div>
        </div>
      )}
      
      <div className="container home-shell">
        <aside className="home-sidebar fade-in">
          <div className="home-brand">Securify</div>
          <p className="home-brand-sub">Corporation for Discord</p>

          <nav className="home-tab-nav">
            <Link to="/global" className="home-tab-link">Global Setup</Link>
            <Link to="/botstatus" className="home-tab-link">Bot Status</Link>
            <Link to="/serverstats" className="home-tab-link">Server Stats</Link>
            <Link to="/botcontrols" className="home-tab-link">Bot Controls</Link>
            <Link to="/invite" className="home-tab-link">Invite Bot</Link>
            <Link to="/tickets" className="home-tab-link">Tickets</Link>
            <Link to="/source" className="home-tab-link">Source Code</Link>
          </nav>
        </aside>

        <main className="home-main fade-in">
          <h1 className="home-main-title">Securify</h1>
          <p className="home-main-subtitle">
            Grey theme dashboard for managing and expanding into a global Discord bot platform.
          </p>

          <div className="card" style={{ maxWidth: '760px' }}>
            <h2 style={{ marginBottom: '0.75rem' }}>Global Bot Direction</h2>
            <p style={{ opacity: 0.75, lineHeight: '1.6' }}>
              Use the Global Setup tab to configure OAuth credentials (client id, secret, bot token), authorize with Discord, and enable command modules.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

export default HomePage;
