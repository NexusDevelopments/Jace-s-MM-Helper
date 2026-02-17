import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function BotStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/bot/status');
      const data = await response.json();
      setStatus(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching status:', error);
      setLoading(false);
    }
  };

  const controlBot = async (action) => {
    try {
      const response = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const data = await response.json();

      if (data.success) {
        setMessage(data.message || `Bot ${action} successful!`);
        setMessageType('success');
        setTimeout(() => fetchStatus(), 2000);
      } else {
        setMessage(data.message || `Failed to ${action} bot.`);
        setMessageType('error');
      }

      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 5000);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
      setMessageType('error');
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 5000);
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return '--';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  if (loading) {
    return (
      <>
        <div className="animated-bg"></div>
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <div>Loading status...</div>
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
            Bot Status Dashboard
          </h1>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link>
            <Link to="/serverstats" style={{ color: '#fff', textDecoration: 'none' }}>Server Stats</Link>
          </div>
        </div>

        <div className="card slide-in" style={{ marginBottom: '1.5rem' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1.5rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Status Overview</h2>
            <div className={`badge ${status?.online ? 'online' : 'offline'}`}>
              <span className={`status-dot ${status?.online ? 'online' : 'offline'}`}></span>
              <span>{status?.online ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          <div className="grid grid-2">
            <div style={{ 
              padding: '1rem', 
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>UPTIME</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                {formatUptime(status?.uptime)}
              </div>
            </div>
            <div style={{ 
              padding: '1rem', 
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>BOT USER</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                {status?.username || '--'}
              </div>
            </div>
            <div style={{ 
              padding: '1rem', 
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>SERVERS</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                {status?.guilds || '0'}
              </div>
            </div>
            <div style={{ 
              padding: '1rem', 
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>PING</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                {status?.ping ? `${status.ping} ms` : '-- ms'}
              </div>
            </div>
          </div>
        </div>

        <div className="card slide-in" style={{ animationDelay: '0.1s' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>
            Bot Controls
          </h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => controlBot('start')}
              disabled={status?.online}
              style={{ flex: '1', minWidth: '120px' }}
            >
              Start
            </button>
            <button 
              className="btn" 
              onClick={() => controlBot('stop')}
              disabled={!status?.online}
              style={{ flex: '1', minWidth: '120px' }}
            >
              Stop
            </button>
            <button 
              className="btn" 
              onClick={() => controlBot('restart')}
              disabled={!status?.online}
              style={{ flex: '1', minWidth: '120px' }}
            >
              Restart
            </button>
          </div>
          
          {message && (
            <div style={{
              marginTop: '1rem',
              padding: '12px',
              borderRadius: '8px',
              background: messageType === 'success' 
                ? 'rgba(255, 255, 255, 0.1)' 
                : 'rgba(255, 100, 100, 0.1)',
              border: `1px solid ${messageType === 'success' ? '#fff' : '#ff6464'}`,
              fontWeight: '500'
            }}>
              {message}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default BotStatus;
