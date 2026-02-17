import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const PASSWORD = 'jacesmmlockedkey2026';

function SourceCode() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Check if already authenticated in session
    const auth = sessionStorage.getItem('srcAuth');
    if (auth === 'true') {
      setAuthenticated(true);
      fetchFileList();
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === PASSWORD) {
      setAuthenticated(true);
      sessionStorage.setItem('srcAuth', 'true');
      setError('');
      fetchFileList();
    } else {
      setError('Invalid password');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setAuthenticated(false);
    sessionStorage.removeItem('srcAuth');
    setPassword('');
    setSelectedFile(null);
    setFileContent('');
  };

  const fetchFileList = async () => {
    try {
      const response = await fetch('/api/source/files');
      const data = await response.json();
      if (data.success) {
        setFiles(data.files);
        setTotalFiles(data.totalFiles || data.files.length);
      }
    } catch (error) {
      console.error('Error fetching file list:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFileList();
    setTimeout(() => setRefreshing(false), 500);
  };

  const fetchFileContent = async (filePath) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/source/file?path=${encodeURIComponent(filePath)}`);
      const data = await response.json();
      if (data.success) {
        setFileContent(data.content);
        setSelectedFile(filePath);
      }
    } catch (error) {
      console.error('Error fetching file content:', error);
    }
    setLoading(false);
  };

  const getFileIcon = (filename) => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.js') || lower.endsWith('.jsx')) return '{ }';
    if (lower.endsWith('.json')) return '[ ]';
    if (lower.endsWith('.css')) return '#';
    if (lower.endsWith('.md')) return 'M';
    if (lower.endsWith('.html')) return '<>';
    if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return '⚙';
    if (lower.endsWith('.txt')) return '📄';
    if (lower.endsWith('.env')) return '🔐';
    if (lower.endsWith('.gitignore') || lower.endsWith('.dockerignore')) return '⊗';
    if (lower === 'dockerfile' || lower.endsWith('dockerfile')) return '🐳';
    if (lower === 'procfile') return '⚡';
    if (lower.endsWith('.cjs') || lower.endsWith('.mjs')) return 'JS';
    return '📁';
  };

  const getLineNumbers = (content) => {
    const lines = content.split('\n');
    return lines.map((_, i) => i + 1).join('\n');
  };

  if (!authenticated) {
    return (
      <>
        <div className="animated-bg"></div>
        <div className="container" style={{ 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '100vh',
          display: 'flex'
        }}>
          <div className="card fade-in" style={{ maxWidth: '500px', width: '100%' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1rem', textAlign: 'center' }}>
              Source Code Access
            </h1>
            <p style={{ opacity: 0.7, marginBottom: '2rem', textAlign: 'center' }}>
              This page is password protected
            </p>
            
            <form onSubmit={handleLogin}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '1rem',
                  marginBottom: '1rem'
                }}
                autoFocus
              />
              
              {error && (
                <div style={{
                  padding: '10px',
                  background: 'rgba(255, 100, 100, 0.1)',
                  border: '1px solid rgba(255, 100, 100, 0.3)',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  textAlign: 'center',
                  color: '#ff6464'
                }}>
                  {error}
                </div>
              )}
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Unlock
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <Link to="/" style={{ color: '#fff', textDecoration: 'none', opacity: 0.7 }}>
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="animated-bg"></div>
      <div className="container" style={{ padding: '40px 20px', maxWidth: '1400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="fade-in">
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: '800' }}>
            Source Code Viewer
          </h1>
          <p style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '1rem' }}>
            All files from GitHub repository • Updates automatically
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', alignItems: 'center' }}>
            <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link>
            <button 
              onClick={handleLogout}
              style={{
                background: 'none',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                padding: '5px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', height: 'calc(100vh - 200px)' }}>
          {/* File List Sidebar */}
          <div className="card slide-in" style={{ overflowY: 'auto', padding: '1rem' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, opacity: 0.8 }}>
                  Files
                </h3>
                <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>
                  {totalFiles} files total
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '5px',
                  cursor: refreshing ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: refreshing ? 0.5 : 1
                }}
              >
                <span style={{ 
                  display: 'inline-block',
                  animation: refreshing ? 'spin 1s linear infinite' : 'none'
                }}>
                  ↻
                </span>
                Refresh
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {files.map((file, index) => (
                <button
                  key={index}
                  onClick={() => fetchFileContent(file)}
                  style={{
                    background: selectedFile === file ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    border: selectedFile === file ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedFile !== file) {
                      e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedFile !== file) {
                      e.target.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>{getFileIcon(file)}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Code Display */}
          <div className="card slide-in" style={{ animationDelay: '0.1s', overflowY: 'auto', padding: 0 }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 15px' }}></div>
                <div>Loading...</div>
              </div>
            ) : selectedFile ? (
              <>
                <div style={{
                  padding: '12px 20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  fontFamily: 'monospace',
                  fontSize: '0.9rem'
                }}>
                  {selectedFile}
                </div>
                <div style={{ display: 'flex' }}>
                  <pre style={{
                    padding: '20px 10px',
                    margin: 0,
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    lineHeight: '1.6',
                    textAlign: 'right',
                    userSelect: 'none',
                    minWidth: '50px'
                  }}>
                    {getLineNumbers(fileContent)}
                  </pre>
                  <pre style={{
                    flex: 1,
                    padding: '20px',
                    margin: 0,
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    lineHeight: '1.6',
                    color: '#fff',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {fileContent}
                  </pre>
                </div>
              </>
            ) : (
              <div style={{ 
                padding: '40px', 
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                opacity: 0.5
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{'</>'}</div>
                <div>Select a file to view its source code</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default SourceCode;
