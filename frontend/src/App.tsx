import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Join } from './pages/Join';
import { Lobby } from './pages/Lobby';
import { Contest } from './pages/Contest';
import { AdminLogin } from './pages/AdminLogin';
import { Admin } from './pages/Admin';
import { Scoreboard } from './pages/Scoreboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/join" replace />} />
        <Route path="/join" element={<Join />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/contest" element={<Contest />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/scoreboard" element={<Scoreboard />} />
        <Route path="*" element={<Navigate to="/join" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
