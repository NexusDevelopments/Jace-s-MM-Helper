import { Link } from 'react-router-dom';

function HomePage() {
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
            Jace's Promo/Demo Bot
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
          </div>
        </div>
      </div>
    </>
  );
}

export default HomePage;
