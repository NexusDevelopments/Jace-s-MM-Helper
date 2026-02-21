import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const DEFAULT_FORM = {
  guildId: '',
  panelChannelId: '',
  categoryId: '',
  supportRoleId: '',
  logChannelId: '',
  panelTitle: 'Support Tickets',
  panelDescription: 'Need help? Click Open Ticket and our team will assist you.'
};
const TICKETS_LAST_GUILD_KEY = 'tickets:lastGuildId';
const TICKETS_LAST_FORM_KEY = 'tickets:lastForm';

function Tickets() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState(DEFAULT_FORM);

  const applyServerConfig = (guildId, config) => {
    if (!config) return;
    setForm((prev) => ({
      ...prev,
      guildId,
      panelChannelId: config.panelChannelId || '',
      categoryId: config.categoryId || '',
      supportRoleId: config.supportRoleId || '',
      logChannelId: config.logChannelId || '',
      panelTitle: config.panelTitle || DEFAULT_FORM.panelTitle,
      panelDescription: config.panelDescription || DEFAULT_FORM.panelDescription
    }));
  };

  const loadConfigForGuild = async (guildId) => {
    const normalizedGuildId = String(guildId || '').trim();
    if (!/^\d{17,20}$/.test(normalizedGuildId)) return;

    try {
      const response = await fetch(`/api/tickets/config?guildId=${encodeURIComponent(normalizedGuildId)}`);
      const data = await response.json();
      if (!response.ok || !data.success) return;
      applyServerConfig(normalizedGuildId, data.config);
    } catch {
      // ignore auto-load failures to avoid interrupting setup flow
    }
  };

  useEffect(() => {
    const init = async () => {
      const savedFormRaw = localStorage.getItem(TICKETS_LAST_FORM_KEY);
      if (savedFormRaw) {
        try {
          const parsedForm = JSON.parse(savedFormRaw);
          if (parsedForm && typeof parsedForm === 'object') {
            setForm((prev) => ({
              ...prev,
              ...DEFAULT_FORM,
              ...parsedForm
            }));
          }
        } catch {
          // ignore invalid cache
        }
      }

      const lastGuildId = localStorage.getItem(TICKETS_LAST_GUILD_KEY) || '';
      if (lastGuildId) {
        setForm((prev) => ({ ...prev, guildId: lastGuildId }));
        await loadConfigForGuild(lastGuildId);
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    const guildId = String(form.guildId || '').trim();
    if (guildId) {
      localStorage.setItem(TICKETS_LAST_GUILD_KEY, guildId);
    }

    localStorage.setItem(TICKETS_LAST_FORM_KEY, JSON.stringify(form));

    const timer = setTimeout(() => {
      loadConfigForGuild(guildId);
    }, 350);

    return () => clearTimeout(timer);
  }, [form.guildId]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const saveConfig = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch('/api/tickets/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save ticket config');
      }

      applyServerConfig(String(form.guildId || '').trim(), data.config || null);
      showMessage('success', 'Ticket configuration saved successfully.');
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const deployPanel = async () => {
    try {
      const response = await fetch('/api/tickets/panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: form.guildId })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to deploy panel');
      }

      showMessage('success', 'Ticket panel deployed in your configured panel channel.');
    } catch (error) {
      showMessage('error', error.message);
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
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }} className="fade-in">
          <h1 style={{ fontSize: '2.3rem', marginBottom: '0.6rem', fontWeight: '800' }}>
            Advanced Ticket System
          </h1>
          <p style={{ opacity: 0.7 }}>
            Configure secure trade tickets from the site and manage with `j$` commands.
          </p>
        </div>

        {message.text && (
          <div
            className="card"
            style={{
              marginBottom: '1rem',
              borderColor: message.type === 'success' ? 'rgba(255,255,255,0.35)' : 'rgba(255,100,100,0.5)',
              background: message.type === 'success' ? 'rgba(255,255,255,0.06)' : 'rgba(255,100,100,0.12)'
            }}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <form className="card" onSubmit={saveConfig}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Website Setup</h2>
            <input type="text" placeholder="Guild ID" value={form.guildId} onChange={(e) => setForm((prev) => ({ ...prev, guildId: e.target.value }))} style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} required />
            <input type="text" placeholder="Panel Channel ID" value={form.panelChannelId} onChange={(e) => setForm((prev) => ({ ...prev, panelChannelId: e.target.value }))} style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} required />
            <input type="text" placeholder="Ticket Category ID" value={form.categoryId} onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))} style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} required />
            <input type="text" placeholder="Support Role ID (optional)" value={form.supportRoleId} onChange={(e) => setForm((prev) => ({ ...prev, supportRoleId: e.target.value }))} style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} />
            <input type="text" placeholder="Log Channel ID (optional)" value={form.logChannelId} onChange={(e) => setForm((prev) => ({ ...prev, logChannelId: e.target.value }))} style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} />
            <input type="text" placeholder="Panel Title" value={form.panelTitle} onChange={(e) => setForm((prev) => ({ ...prev, panelTitle: e.target.value }))} style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} />
            <textarea placeholder="Panel Description" value={form.panelDescription} onChange={(e) => setForm((prev) => ({ ...prev, panelDescription: e.target.value }))} rows={3} style={{ width: '100%', marginBottom: '0.9rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit">Save Config</button>
              <button className="btn" type="button" onClick={deployPanel}>Deploy Panel</button>
              <Link to="/logs" className="btn" style={{ textDecoration: 'none' }}>Ticket Logs</Link>
            </div>
          </form>

          <div className="card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Discord Commands (`j$`)</h2>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              <div>`j$ticket help`</div>
              <div>`j$ticket setup &lt;panelChannelId&gt; &lt;categoryId&gt; [supportRoleId] [logChannelId]`</div>
              <div>`j$ticket panel`</div>
              <div>`j$ticket create`</div>
              <div>`j$ticket close`</div>
              <div>`j$ticket claim`</div>
              <div>`j$ticket status &lt;text&gt;`</div>
              <div>`j$ticket done`</div>
              <div>`j$ticket add &lt;userId|@mention&gt;`</div>
              <div>`j$ticket remove &lt;userId|@mention&gt;`</div>
              <div>`j$ticket transcript`</div>
            </div>
            <p style={{ marginTop: '1rem', opacity: 0.7, lineHeight: '1.6' }}>
              Features include support-only claim/close controls, required trade details on ticket open, partner confirmation flow, status tracking, close transcripts, and website ticket logs.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default Tickets;
