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
      <div className="container" style={{ 
        justifyContent: 'center', 
        alignItems: 'center',
        textAlign: 'center' 
      }}>
        <div className="fade-in">
          <h1 style={{ 
            fontSize: 'clamp(2.5rem, 8vw, 5rem)', 
            marginBottom: '2rem',
            fontWeight: '900',
            letterSpacing: '-2px',
            textTransform: 'uppercase'
          }}>
            Jace's MM Helper
          </h1>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            maxWidth: '300px',
            margin: '0 auto'
          }}>
            <Link to="/botstatus" className="btn btn-primary">
              Bot Status
            </Link>
            <Link to="/serverstats" className="btn">
              Server Stats
            </Link>
            <Link to="/invite" className="btn">
              Invite Bot
            </Link>
            <Link to="/tickets" className="btn">
              Tickets
            </Link>
            <Link to="/botcontrols" className="btn">
              Bot Controls
            </Link>
            <Link to="/source" className="btn">
              Source Code
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default HomePage;
