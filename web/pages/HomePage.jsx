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
            Global moderation and security platform for Discord communities.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <Link to="/global" className="btn btn-primary">Sign in with Discord</Link>
            <Link to="/botcontrols" className="btn">Open Command Console</Link>
          </div>

          <div className="home-metrics">
            <div className="home-metric-card">
              <div className="home-metric-value">24/7</div>
              <div className="home-metric-label">Threat monitoring</div>
            </div>
            <div className="home-metric-card">
              <div className="home-metric-value">7</div>
              <div className="home-metric-label">Command modules</div>
            </div>
            <div className="home-metric-card">
              <div className="home-metric-value">1-click</div>
              <div className="home-metric-label">Discord onboarding</div>
            </div>
          </div>

          <div className="home-feature-grid">
            <div className="card">
              <h2 style={{ marginBottom: '0.5rem' }}>Auto moderation</h2>
              <p style={{ opacity: 0.75, lineHeight: '1.6' }}>
                Filter spam, mass mentions, dangerous links, and suspicious behavior in real-time.
              </p>
            </div>
            <div className="card">
              <h2 style={{ marginBottom: '0.5rem' }}>Anti-raid protection</h2>
              <p style={{ opacity: 0.75, lineHeight: '1.6' }}>
                Lock down channels, rate-limit joins, and enforce verification during attacks.
              </p>
            </div>
            <div className="card">
              <h2 style={{ marginBottom: '0.5rem' }}>Audit logging</h2>
              <p style={{ opacity: 0.75, lineHeight: '1.6' }}>
                Keep complete moderation logs and role-history trails for accountability.
              </p>
            </div>
            <div className="card">
              <h2 style={{ marginBottom: '0.5rem' }}>Global command center</h2>
              <p style={{ opacity: 0.75, lineHeight: '1.6' }}>
                Configure OAuth, credentials, and module toggles from one centralized dashboard.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default HomePage;
