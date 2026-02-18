import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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
      
      <div className="container" style={{ 
        justifyContent: 'center', 
        alignItems: 'center',
        textAlign: 'center' 
      }}>
        <div className="fade-in">
          <h1 style={{ 
            fontSize: 'clamp(2.5rem, 8vw, 5rem)', 
            marginBottom: '0.5rem',
            fontWeight: '900',
            letterSpacing: '-2px',
            textTransform: 'uppercase',
            background: 'linear-gradient(135deg, #fff 0%, #888 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 0 80px rgba(255, 255, 255, 0.3)'
          }}>
            Jace's MM Helper
          </h1>
          
          <p style={{
            fontSize: '1rem',
            opacity: 0.6,
            marginBottom: '3rem',
            letterSpacing: '2px',
            fontWeight: '300'
          }}>
            Discord Management Made Easy
          </p>
          
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.2rem',
            maxWidth: '900px',
            margin: '0 auto',
            padding: '0 20px'
          }}>
            <Link to="/botstatus" className="home-btn btn-glass">
              <span className="btn-text">
                <span className="btn-title">Bot Status</span>
                <span className="btn-subtitle">Monitor bot activity</span>
              </span>
              <span className="btn-arrow">→</span>
            </Link>
            
            <Link to="/serverstats" className="home-btn btn-glass">
              <span className="btn-text">
                <span className="btn-title">Server Stats</span>
                <span className="btn-subtitle">View server info</span>
              </span>
              <span className="btn-arrow">→</span>
            </Link>
            
            <Link to="/invite" className="home-btn btn-glass">
              <span className="btn-text">
                <span className="btn-title">Invite Bot</span>
                <span className="btn-subtitle">Add to your server</span>
              </span>
              <span className="btn-arrow">→</span>
            </Link>
            
            <Link to="/tickets" className="home-btn btn-glass">
              <span className="btn-text">
                <span className="btn-title">Tickets</span>
                <span className="btn-subtitle">Support system</span>
              </span>
              <span className="btn-arrow">→</span>
            </Link>
            
            <Link to="/botcontrols" className="home-btn btn-glass">
              <span className="btn-text">
                <span className="btn-title">Bot Controls</span>
                <span className="btn-subtitle">Advanced features</span>
              </span>
              <span className="btn-arrow">→</span>
            </Link>
            
            <Link to="/source" className="home-btn btn-glass">
              <span className="btn-text">
                <span className="btn-title">Source Code</span>
                <span className="btn-subtitle">View repository</span>
              </span>
              <span className="btn-arrow">→</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default HomePage;
