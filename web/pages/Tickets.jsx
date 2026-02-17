import { Link } from 'react-router-dom';

function Tickets() {
  return (
    <>
      <div className="animated-bg"></div>
      <div className="container" style={{ 
        justifyContent: 'center', 
        alignItems: 'center',
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex'
      }}>
        <div className="card fade-in" style={{ maxWidth: '600px', width: '100%' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800', 
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #fff 0%, #888 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Tickets System in Development
          </h1>
          
          <p style={{ 
            fontSize: '1.1rem', 
            opacity: 0.7, 
            lineHeight: '1.6',
            marginBottom: '2rem'
          }}>
            We're working hard to bring you an amazing ticket system. Stay tuned!
          </p>

          <div className="spinner" style={{ margin: '2rem auto' }}></div>

          <Link to="/" className="btn" style={{ marginTop: '1rem' }}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </>
  );
}

export default Tickets;
