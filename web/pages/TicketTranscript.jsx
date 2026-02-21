import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

function TicketTranscript() {
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState(null);

  const guildId = (searchParams.get('guildId') || '').trim();
  const ticketId = (searchParams.get('id') || '').trim();

  useEffect(() => {
    const loadTranscript = async () => {
      setLoading(true);
      setError('');
      setTranscript(null);

      if (!guildId || !ticketId) {
        setError('Missing guildId or ticket id in URL.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/tickets/transcript?guildId=${encodeURIComponent(guildId)}&id=${encodeURIComponent(ticketId)}`);
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to load transcript');
        }
        setTranscript(data.transcript || null);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    loadTranscript();
  }, [guildId, ticketId]);

  if (loading) {
    return (
      <>
        <div className="animated-bg"></div>
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <div>Loading transcript...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="animated-bg"></div>
      <div className="container" style={{ padding: '40px 20px', maxWidth: '1100px' }}>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', marginBottom: '0.35rem' }}>Transcript: Ticket #{ticketId}</h1>
              <div style={{ opacity: 0.7 }}>Guild: {guildId}</div>
            </div>
            <a
              href={`/api/tickets/transcript/download?guildId=${encodeURIComponent(guildId)}&id=${encodeURIComponent(ticketId)}`}
              className="btn btn-primary"
              style={{ textDecoration: 'none' }}
            >
              Download TXT
            </a>
          </div>
        </div>

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,100,100,0.6)', background: 'rgba(255,100,100,0.12)' }}>
            {error}
          </div>
        )}

        {!error && transcript && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {(transcript.entries || []).length === 0 ? (
              <div className="card">No messages found in this transcript.</div>
            ) : (
              transcript.entries.map((entry, index) => (
                <div key={entry.messageId || `${index}-${entry.timestamp || 0}`} className="card" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <img
                      src={entry.avatarUrl}
                      alt={entry.authorTag}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                        <strong>{entry.authorTag}</strong>
                        <span style={{ opacity: 0.7, fontSize: '0.9rem' }}>
                          {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Unknown time'}
                        </span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{entry.content || '[empty]'}</div>
                      {Array.isArray(entry.attachments) && entry.attachments.length > 0 ? (
                        <div style={{ marginTop: '0.5rem', opacity: 0.82 }}>
                          {entry.attachments.map((attachment) => (
                            <div key={attachment}>
                              <a href={attachment} target="_blank" rel="noreferrer" style={{ color: '#fff' }}>
                                {attachment}
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default TicketTranscript;
