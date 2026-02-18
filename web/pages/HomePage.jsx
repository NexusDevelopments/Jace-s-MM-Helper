import { useState, useEffect } from 'react';

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

      <div className="container">
        <main className="main-content fade-in" style={{ paddingTop: '40px' }}>
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
