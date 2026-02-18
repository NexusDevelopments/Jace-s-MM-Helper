import { BrowserRouter as Router, NavLink, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BotStatus from './pages/BotStatus';
import ServerStats from './pages/ServerStats';
import InviteBot from './pages/InviteBot';
import SourceCode from './pages/SourceCode';
import Tickets from './pages/Tickets';
import BotControls from './pages/BotControls';
import GlobalSetup from './pages/GlobalSetup';
import logo from './assets/securify-logo.svg';

function App() {
  return (
    <Router>
      <div className="app-shell">
        <aside className="global-side-panel">
          <div className="side-brand">
            <img src={logo} alt="Securify logo" className="home-logo" />
            <div className="side-brand-text">Securify</div>
          </div>
          <div className="side-section">Navigation</div>
          <nav className="side-nav">
            <NavLink to="/" className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>Home</NavLink>
            <NavLink to="/botstatus" className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>Bot Status</NavLink>
            <NavLink to="/serverstats" className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>Server Stats</NavLink>
            <NavLink to="/invite" className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>Invite Bot</NavLink>
            <NavLink to="/botcontrols" className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>Bot Controls</NavLink>
            <NavLink to="/global" className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>Global Setup</NavLink>
            <NavLink to="/tickets" className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>Tickets</NavLink>
            <NavLink to="/source" className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>Source Code</NavLink>
          </nav>
        </aside>

        <div className="global-page-region">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/botstatus" element={<BotStatus />} />
            <Route path="/serverstats" element={<ServerStats />} />
            <Route path="/invite" element={<InviteBot />} />
            <Route path="/source" element={<SourceCode />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/botcontrols" element={<BotControls />} />
            <Route path="/global" element={<GlobalSetup />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
