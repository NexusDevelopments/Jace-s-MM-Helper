import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function Logs() {
  const [loading, setLoading] = useState(true);
  const [guildId, setGuildId] = useState('');
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const loadLogs = async () => {
    setError('');
    if (!guildId.trim()) {
      setError('Guild ID is required.');
      return;
    }

    try {
      const response = await fetch(`/api/tickets/logs?guildId=${encodeURIComponent(guildId.trim())}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load ticket logs');
      }
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

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
      <div className="container" style={{ padding: '40px 20px', maxWidth: '1100px' }}>
        <div className="card fade-in" style={{ width: '100%' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.9rem' }}>Ticket Logs</h1>
          <p style={{ fontSize: '1rem', opacity: 0.72, marginBottom: '1rem' }}>
            View recent ticket open/close logs by guild.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Guild ID"
              value={guildId}
              onChange={(event) => setGuildId(event.target.value)}
              style={{ flex: '1 1 300px', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <button className="btn btn-primary" type="button" onClick={loadLogs}>Load Logs</button>
          </div>

          {error && (
            <div className="card" style={{ marginBottom: '1rem', borderColor: 'rgba(255,100,100,0.6)', background: 'rgba(255,100,100,0.12)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {logs.length === 0 ? (
              <div style={{ opacity: 0.65 }}>No logs loaded yet.</div>
            ) : (
              logs.map((log, index) => (
                <div key={`${log.ticketNumber || 'ticket'}-${index}`} className="card" style={{ padding: '14px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>
                    #{log.ticketNumber || 'N/A'} · {String(log.type || 'log').toUpperCase()}
                  </div>
                  <div style={{ opacity: 0.82, lineHeight: '1.55' }}>
                    <div>Channel: {log.channelId || 'N/A'}</div>
                    <div>Opened by: {log.openerId || 'N/A'}</div>
                    {log.closedBy ? <div>Closed by: {log.closedBy}</div> : null}
                    {log.closeReason ? <div>Reason: {log.closeReason}</div> : null}
                    {log.tradeDetails ? <div>Trade: {log.tradeDetails}</div> : null}
                    <div>Created: {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Unknown'}</div>
                  </div>
                  {log.ticketNumber ? (
                    <div style={{ marginTop: '0.7rem' }}>
                      <Link
                        to={`/id?id=${encodeURIComponent(String(log.ticketNumber))}&guildId=${encodeURIComponent(guildId.trim())}`}
                        className="btn"
                        style={{ textDecoration: 'none' }}
                      >
                        Transcript
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Logs;
