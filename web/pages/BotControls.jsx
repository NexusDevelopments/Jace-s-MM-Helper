import { Link } from 'react-router-dom';

function BotControls() {
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
        <div className="card fade-in" style={{ maxWidth: '700px', width: '100%' }}>
          <h1 style={{ 
            fontSize: '3rem', 
            fontWeight: '800', 
            marginBottom: '1.5rem',
            background: 'linear-gradient(135deg, #fff 0%, #888 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Coming Soon
          </h1>
          
          <p style={{ 
            fontSize: '0.9rem', 
            opacity: 0.6, 
            lineHeight: '1.8',
            marginBottom: '2rem',
            maxWidth: '500px',
            margin: '0 auto'
          }}>
            Bot Controls will allow you to act like the bot and send messages, send embeds, send images, join servers, and more.
          </p>

          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            justifyContent: 'center',
            marginTop: '2.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              opacity: 0.5
            }}>
              Send Messages
            </div>
            <div style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              opacity: 0.5
            }}>
              Send Embeds
            </div>
            <div style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              opacity: 0.5
            }}>
              Send Images
            </div>
            <div style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              opacity: 0.5
            }}>
              Join Servers
            </div>
          </div>

          <Link to="/" className="btn" style={{ marginTop: '2.5rem' }}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </>
  );
}

export default BotControls;
