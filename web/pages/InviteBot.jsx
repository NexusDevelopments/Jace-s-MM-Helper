import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function InviteBot() {
  const [botId, setBotId] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [adminInviteUrl, setAdminInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBotInfo();
  }, []);

  const fetchBotInfo = async () => {
    try {
      const response = await fetch('/api/bot/status');
      const data = await response.json();
      
      if (data.online && data.botId) {
        const id = data.botId;
        setBotId(id);
        
        // Generate invite URLs with different permission sets
        // 268445760 = Manage Roles, View Channels, Send Messages, Embed Links, etc.
        // 8 = Administrator
        
        setInviteUrl(`https://discord.com/api/oauth2/authorize?client_id=${id}&permissions=268445760&scope=bot`);
        setAdminInviteUrl(`https://discord.com/api/oauth2/authorize?client_id=${id}&permissions=8&scope=bot`);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching bot info:', error);
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Invite link copied to clipboard!');
  };

  if (loading) {
    return (
      <>
        <div className="animated-bg"></div>
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <div>Loading bot info...</div>
          </div>
        </div>
      </>
    );
  }

  if (!inviteUrl) {
    return (
      <>
        <div className="animated-bg"></div>
        <div className="container" style={{ padding: '40px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="fade-in">
            <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: '800' }}>
              Invite Bot
            </h1>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link>
              <Link to="/botstatus" style={{ color: '#fff', textDecoration: 'none' }}>Bot Status</Link>
              <Link to="/serverstats" style={{ color: '#fff', textDecoration: 'none' }}>Server Stats</Link>
            </div>
          </div>

          <div className="card" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>
              Bot is Offline
            </h2>
            <p style={{ opacity: 0.8, lineHeight: '1.6' }}>
              The bot needs to be online to generate invite links. Please start the bot first from the Bot Status page.
            </p>
            <Link to="/botstatus" className="btn btn-primary" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
              Go to Bot Status
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="animated-bg"></div>
      <div className="container" style={{ padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="fade-in">
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: '800' }}>
            Invite Bot
          </h1>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link>
            <Link to="/botstatus" style={{ color: '#fff', textDecoration: 'none' }}>Bot Status</Link>
            <Link to="/serverstats" style={{ color: '#fff', textDecoration: 'none' }}>Server Stats</Link>
          </div>
        </div>

        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card slide-in" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>
              Recommended Permissions
            </h2>
            <p style={{ opacity: 0.8, marginBottom: '1.5rem', lineHeight: '1.6' }}>
              This invite link includes the recommended permissions for the bot to function properly with demo/promo commands.
            </p>
            
            <div style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <input
                type="text"
                value={inviteUrl}
                readOnly
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace'
                }}
              />
              <button
                className="btn"
                onClick={() => copyToClipboard(inviteUrl)}
                style={{ minWidth: '100px' }}
              >
                Copy
              </button>
            </div>

            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ width: '100%', display: 'block', textAlign: 'center' }}
            >
              Invite Bot (Recommended)
            </a>
          </div>

          <div className="card slide-in" style={{ animationDelay: '0.1s', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>
              Administrator Permissions
            </h2>
            <p style={{ opacity: 0.8, marginBottom: '1.5rem', lineHeight: '1.6' }}>
              This invite link includes administrator permissions. Only use this if you fully trust the bot.
            </p>
            
            <div style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <input
                type="text"
                value={adminInviteUrl}
                readOnly
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace'
                }}
              />
              <button
                className="btn"
                onClick={() => copyToClipboard(adminInviteUrl)}
                style={{ minWidth: '100px' }}
              >
                Copy
              </button>
            </div>

            <a
              href={adminInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ width: '100%', display: 'block', textAlign: 'center' }}
            >
              Invite Bot (Admin)
            </a>
          </div>

          <div className="card slide-in" style={{ animationDelay: '0.2s' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>
              Required Permissions
            </h2>
            <p style={{ opacity: 0.8, marginBottom: '1rem', lineHeight: '1.6' }}>
              For the bot to work properly, it needs the following permissions:
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem'
            }}>
              <div style={{
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                Manage Roles
              </div>
              <div style={{
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                View Channels
              </div>
              <div style={{
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                Send Messages
              </div>
              <div style={{
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                Embed Links
              </div>
              <div style={{
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                Read Message History
              </div>
              <div style={{
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                Use Application Commands
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default InviteBot;
