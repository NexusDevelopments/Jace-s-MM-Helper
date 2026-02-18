import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function GlobalSetup() {
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(null);
  const [oauthUrl, setOauthUrl] = useState('');
  const [commands, setCommands] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    companyName: 'Securify',
    clientId: '',
    clientSecret: '',
    botToken: '',
    redirectUri: '',
    scopes: 'identify guilds'
  });

  useEffect(() => {
    loadSetup();
  }, []);

  const loadSetup = async () => {
    try {
      const response = await fetch('/api/global/setup');
      const data = await response.json();
      if (data.success) {
        setSetup(data.setup);
        setOauthUrl(data.oauthUrl || '');
        setCommands(data.commandCatalog || []);
        setForm((prev) => ({
          ...prev,
          companyName: data.setup.companyName || 'Securify',
          clientId: data.setup.clientId || '',
          redirectUri: data.setup.redirectUri || '',
          scopes: data.setup.scopes || 'identify guilds'
        }));
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load setup data.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/global/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Setup failed');
      }

      setMessage({ type: 'success', text: data.message || 'Setup saved successfully.' });
      setOauthUrl(data.oauthUrl || '');
      setForm((prev) => ({ ...prev, clientSecret: '', botToken: '' }));
      await loadSetup();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  if (loading) {
    return (
      <>
        <div className="animated-bg"></div>
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <div>Loading setup...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="animated-bg"></div>
      <div className="container" style={{ padding: '40px 20px', maxWidth: '1100px' }}>
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.3rem', fontWeight: '800', marginBottom: '0.5rem' }}>
            Securify Global Bot Setup
          </h1>
          <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
            Dyno/Carl style onboarding flow (MVP)
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link>
            <Link to="/botstatus" style={{ color: '#fff', textDecoration: 'none' }}>Bot Status</Link>
            <Link to="/botcontrols" style={{ color: '#fff', textDecoration: 'none' }}>Bot Controls</Link>
          </div>
        </div>

        {message.text && (
          <div
            className="card"
            style={{
              marginBottom: '1rem',
              borderColor: message.type === 'success' ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 100, 100, 0.4)',
              background: message.type === 'success' ? 'rgba(255,255,255,0.06)' : 'rgba(255, 100, 100, 0.12)'
            }}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <form className="card" onSubmit={handleSubmit}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Credentials</h2>
            <input
              type="text"
              placeholder="Corporation Name"
              value={form.companyName}
              onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <input
              type="text"
              placeholder="Discord Client ID"
              value={form.clientId}
              onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))}
              required
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <input
              type="password"
              placeholder="Discord Client Secret"
              value={form.clientSecret}
              onChange={(event) => setForm((prev) => ({ ...prev, clientSecret: event.target.value }))}
              required
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <input
              type="password"
              placeholder="Bot Token"
              value={form.botToken}
              onChange={(event) => setForm((prev) => ({ ...prev, botToken: event.target.value }))}
              required
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <input
              type="text"
              placeholder="OAuth Redirect URI"
              value={form.redirectUri}
              onChange={(event) => setForm((prev) => ({ ...prev, redirectUri: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <input
              type="text"
              placeholder="Scopes"
              value={form.scopes}
              onChange={(event) => setForm((prev) => ({ ...prev, scopes: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <button className="btn btn-primary" type="submit">Save Global Setup</button>
          </form>

          <div className="card">
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Authorize + Commands</h2>
            <p style={{ opacity: 0.75, marginBottom: '1rem' }}>
              After saving credentials, authorize your Discord account and unlock the global command modules.
            </p>
            {oauthUrl ? (
              <a className="btn btn-primary" href={oauthUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginBottom: '1rem' }}>
                Authorize Discord Account
              </a>
            ) : (
              <p style={{ opacity: 0.65, marginBottom: '1rem' }}>Save setup details to generate OAuth authorization URL.</p>
            )}

            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.65, marginBottom: '0.5rem' }}>AVAILABLE COMMAND GROUPS</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {commands.map((command) => (
                  <div
                    key={command}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.04)'
                    }}
                  >
                    {command}
                  </div>
                ))}
              </div>
            </div>

            {setup?.configured && (
              <p style={{ marginTop: '1rem', opacity: 0.7 }}>
                Last configured: {setup.updatedAt ? new Date(setup.updatedAt).toLocaleString() : 'Unknown'}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default GlobalSetup;
