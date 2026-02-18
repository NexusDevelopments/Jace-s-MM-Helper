import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function BotControls() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [messageForm, setMessageForm] = useState({ channelId: '', message: '' });
  const [embedForm, setEmbedForm] = useState({ channelId: '', title: '', description: '', color: '#87cefa' });
  const [imageForm, setImageForm] = useState({ channelId: '', imageUrl: '', caption: '' });
  const [movementForm, setMovementForm] = useState({
    guildId: '',
    targetChannelId: '',
    snapshotChannelId: '',
    logChannelId: '',
    webhookUrl: ''
  });

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchStatus()]);
      setLoading(false);
    };

    loadData();

    const interval = setInterval(() => {
      fetchStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/bot/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      setStatus(null);
    }
  };

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
  };

  const postControl = async (endpoint, payload) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Action failed');
    }

    return data;
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    try {
      const data = await postControl('/api/bot/controls/send-message', messageForm);
      showFeedback('success', data.message);
      setMessageForm((prev) => ({ ...prev, message: '' }));
    } catch (error) {
      showFeedback('error', error.message);
    }
  };

  const handleSendEmbed = async (event) => {
    event.preventDefault();
    try {
      const data = await postControl('/api/bot/controls/send-embed', embedForm);
      showFeedback('success', data.message);
      setEmbedForm((prev) => ({ ...prev, title: '', description: '' }));
    } catch (error) {
      showFeedback('error', error.message);
    }
  };

  const handleSendImage = async (event) => {
    event.preventDefault();
    try {
      const data = await postControl('/api/bot/controls/send-image', imageForm);
      showFeedback('success', data.message);
      setImageForm((prev) => ({ ...prev, imageUrl: '', caption: '' }));
    } catch (error) {
      showFeedback('error', error.message);
    }
  };

  const handleMovement = async (event) => {
    event.preventDefault();
    try {
      const data = await postControl('/api/bot/controls/movement', movementForm);
      showFeedback('success', data.message);
    } catch (error) {
      showFeedback('error', error.message);
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

  const botOnline = Boolean(status?.online);

  return (
    <>
      <div className="animated-bg"></div>
      <div className="container" style={{ padding: '40px 20px', maxWidth: '1000px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="fade-in">
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: '800' }}>
            Bot Controls
          </h1>
          <p style={{ opacity: 0.65, marginBottom: '1rem' }}>In development • Core controls available now</p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link>
            <Link to="/botstatus" style={{ color: '#fff', textDecoration: 'none' }}>Bot Status</Link>
            <Link to="/serverstats" style={{ color: '#fff', textDecoration: 'none' }}>Server Stats</Link>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className={`badge ${botOnline ? 'online' : 'offline'}`}>
            <span className={`status-dot ${botOnline ? 'online' : 'offline'}`}></span>
            <span>{botOnline ? 'Bot Online' : 'Bot Offline'}</span>
          </div>
          {!botOnline && (
            <p style={{ marginTop: '0.75rem', opacity: 0.7 }}>
              Start the bot from Bot Status before using these controls.
            </p>
          )}
        </div>

        {feedback.text && (
          <div
            className="card"
            style={{
              marginBottom: '1rem',
              borderColor: feedback.type === 'success' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 100, 100, 0.4)',
              background: feedback.type === 'success' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 100, 100, 0.08)'
            }}
          >
            {feedback.text}
          </div>
        )}

        <div className="grid" style={{ gap: '1rem' }}>
          <form className="card" onSubmit={handleSendMessage}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Send Message</h2>
            <input
              type="text"
              placeholder="Channel ID"
              value={messageForm.channelId}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, channelId: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              required
            />
            <textarea
              placeholder="Message"
              value={messageForm.message}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, message: event.target.value }))}
              rows={3}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              required
            />
            <button className="btn btn-primary" type="submit" disabled={!botOnline}>Send Message</button>
          </form>

          <form className="card" onSubmit={handleSendEmbed}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Send Embed</h2>
            <input
              type="text"
              placeholder="Channel ID"
              value={embedForm.channelId}
              onChange={(event) => setEmbedForm((prev) => ({ ...prev, channelId: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              required
            />
            <input
              type="text"
              placeholder="Embed title"
              value={embedForm.title}
              onChange={(event) => setEmbedForm((prev) => ({ ...prev, title: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              required
            />
            <textarea
              placeholder="Embed description"
              value={embedForm.description}
              onChange={(event) => setEmbedForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={3}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              required
            />
            <input
              type="text"
              placeholder="Color hex (optional, e.g. 87cefa)"
              value={embedForm.color}
              onChange={(event) => setEmbedForm((prev) => ({ ...prev, color: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <button className="btn btn-primary" type="submit" disabled={!botOnline}>Send Embed</button>
          </form>

          <form className="card" onSubmit={handleSendImage}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Send Image</h2>
            <input
              type="text"
              placeholder="Channel ID"
              value={imageForm.channelId}
              onChange={(event) => setImageForm((prev) => ({ ...prev, channelId: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              required
            />
            <input
              type="url"
              placeholder="Image URL"
              value={imageForm.imageUrl}
              onChange={(event) => setImageForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              required
            />
            <input
              type="text"
              placeholder="Caption (optional)"
              value={imageForm.caption}
              onChange={(event) => setImageForm((prev) => ({ ...prev, caption: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <button className="btn btn-primary" type="submit" disabled={!botOnline}>Send Image</button>
          </form>

          <form className="card" onSubmit={handleMovement}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Bot Movement</h2>
            <p style={{ opacity: 0.7, marginBottom: '0.75rem', lineHeight: '1.5' }}>
              Moves the bot to a voice channel and sends a channel snapshot report to a webhook or log channel.
            </p>
            <input
              type="text"
              placeholder="Guild ID"
              value={movementForm.guildId}
              onChange={(event) => setMovementForm((prev) => ({ ...prev, guildId: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              required
            />
            <input
              type="text"
              placeholder="Target Voice Channel ID"
              value={movementForm.targetChannelId}
              onChange={(event) => setMovementForm((prev) => ({ ...prev, targetChannelId: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              required
            />
            <input
              type="text"
              placeholder="Snapshot Channel ID (optional)"
              value={movementForm.snapshotChannelId}
              onChange={(event) => setMovementForm((prev) => ({ ...prev, snapshotChannelId: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <input
              type="text"
              placeholder="Log Channel ID (optional)"
              value={movementForm.logChannelId}
              onChange={(event) => setMovementForm((prev) => ({ ...prev, logChannelId: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <input
              type="url"
              placeholder="Webhook URL (optional)"
              value={movementForm.webhookUrl}
              onChange={(event) => setMovementForm((prev) => ({ ...prev, webhookUrl: event.target.value }))}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            />
            <button className="btn btn-primary" type="submit" disabled={!botOnline}>Run Bot Movement</button>
          </form>
        </div>
      </div>
    </>
  );
}

export default BotControls;
