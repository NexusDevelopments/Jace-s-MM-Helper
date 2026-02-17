import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BotStatus from './pages/BotStatus';
import ServerStats from './pages/ServerStats';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/botstatus" element={<BotStatus />} />
        <Route path="/serverstats" element={<ServerStats />} />
      </Routes>
    </Router>
  );
}

export default App;
