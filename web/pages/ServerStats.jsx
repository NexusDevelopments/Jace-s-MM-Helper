import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function ServerStats() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchServers = async () => {
    try {
      const response = await fetch('/api/servers');
      const data = await response.json();

      if (data.success) {
        setServers(data.servers);
        setError('');
      } else {
        setError(data.message || 'Failed to fetch server data');
      }
      setLoading(false);
    } catch (err) {
      setError(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  const getInitials = (name) => {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <>
        <div className="animated-bg"></div>
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <div>Loading server data...</div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="animated-bg"></div>
        <div className="container">
          <div className="card" style={{ textAlign: 'center', color: '#ff6464' }}>
            {error}
          </div>
        </div>
      </>
    );
  }

  const totalServers = servers.length;
  const totalMembers = servers.reduce((sum, s) => sum + s.memberCount, 0);
  const avgMembers = totalServers > 0 ? Math.round(totalMembers / totalServers) : 0;

  return (
    <>
      <div className="animated-bg"></div>
      <div className="container" style={{ padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="fade-in">
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: '800' }}>
            Server Statistics
          </h1>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link>
            <Link to="/botstatus" style={{ color: '#fff', textDecoration: 'none' }}>Bot Status</Link>
            <Link to="/invite" style={{ color: '#fff', textDecoration: 'none' }}>Invite Bot</Link>
          </div>
        </div>

        <div className="card slide-in" style={{ marginBottom: '1.5rem' }}>
          <div className="grid grid-3">
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                TOTAL SERVERS
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: '900' }}>
                {totalServers}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                TOTAL MEMBERS
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: '900' }}>
                {totalMembers.toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                AVG MEMBERS/SERVER
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: '900' }}>
                {avgMembers}
              </div>
            </div>
          </div>
        </div>

        <div className="grid" style={{ gap: '1.5rem' }}>
          {servers.map((server, index) => (
            <div 
              key={server.id} 
              className="card slide-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem',
                marginBottom: '1.5rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fff 0%, #999 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000',
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  flexShrink: 0
                }}>
                  {getInitials(server.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '1.4rem', 
                    fontWeight: '700', 
                    marginBottom: '0.25rem' 
                  }}>
                    {server.name}
                  </div>
                  <div style={{ 
                    fontSize: '0.85rem', 
                    opacity: 0.6,
                    fontFamily: 'monospace'
                  }}>
                    ID: {server.id}
                  </div>
                </div>
              </div>

              <div className="grid grid-3" style={{ gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>
                    OWNER
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                    {server.ownerTag || 'Unknown'}
                  </div>
                </div>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>
                    MEMBERS
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                    {server.memberCount.toLocaleString()}
                  </div>
                </div>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>
                    ROLES
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                    {server.roleCount}
                  </div>
                </div>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>
                    CHANNELS
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                    {server.channelCount}
                  </div>
                </div>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>
                    JOINED
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                    {formatDate(server.joinedAt)}
                  </div>
                </div>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>
                    CREATED
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                    {formatDate(server.createdAt)}
                  </div>
                </div>
              </div>

              <div style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px'
              }}>
                <div style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: '700', 
                  opacity: 0.7,
                  marginBottom: '0.75rem',
                  letterSpacing: '1px'
                }}>
                  BOT PERMISSIONS
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '0.5rem'
                }}>
                  {server.permissions.map((perm, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '0.5rem 0.75rem',
                        background: perm === 'Administrator' 
                          ? 'rgba(255, 255, 255, 0.15)' 
                          : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        textAlign: 'center',
                        fontWeight: perm === 'Administrator' ? '700' : '500'
                      }}
                    >
                      {perm}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default ServerStats;
