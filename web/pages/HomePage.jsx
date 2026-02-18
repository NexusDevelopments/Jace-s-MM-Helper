import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/securify-logo.svg';

function HomePage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate brief loading for consistent UX
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

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

      <div className="container dashboard-layout">
        <aside className="side-panel fade-in">
          <div className="side-brand">
            <img src={logo} alt="Securify logo" className="home-logo" />
            <div className="side-brand-text">Securify</div>
          </div>

          <div className="side-section">Navigation</div>
          <nav className="side-nav">
            <Link to="/botstatus" className="side-link">Bot Status</Link>
            <Link to="/serverstats" className="side-link">Server Stats</Link>
            <Link to="/invite" className="side-link">Invite Bot</Link>
            <Link to="/botcontrols" className="side-link">Bot Controls</Link>
            <Link to="/tickets" className="side-link">Tickets</Link>
            <Link to="/source" className="side-link">Source Code</Link>
          </nav>
        </aside>

        <main className="main-content fade-in">
          <h1 style={{
            fontSize: 'clamp(2.2rem, 6vw, 4rem)',
            marginBottom: '0.7rem',
            fontWeight: '900',
            letterSpacing: '-1px'
          }}>
            Securify Dashboard
          </h1>
          <p style={{ opacity: 0.7, marginBottom: '1.2rem' }}>
            Manage your bot from the side panel.
          </p>
          <div className="card" style={{ maxWidth: '760px' }}>
            <p style={{ opacity: 0.78, lineHeight: '1.7' }}>
              Use the navigation panel on the left to access bot status, controls, invites, and source tools.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

export default HomePage;
