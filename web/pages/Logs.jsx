import { useEffect, useState } from 'react';

function Logs() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

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
      <div className="container" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', minHeight: '100vh', display: 'flex' }}>
        <div className="card fade-in" style={{ maxWidth: '700px', width: '100%' }}>
          <h1 style={{ fontSize: '2.4rem', fontWeight: '800', marginBottom: '0.9rem' }}>Audit Log</h1>
          <p style={{ fontSize: '1.05rem', opacity: 0.72, lineHeight: '1.7' }}>
            Coming Soon
          </p>
        </div>
      </div>
    </>
  );
}

export default Logs;
