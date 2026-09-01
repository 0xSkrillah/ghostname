// HashRouter: deep links work on any static host (GitHub Pages, Swarm)
// with zero server configuration — demo reliability over URL aesthetics.
import { HashRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Scan from './pages/Scan';
import Create from './pages/Create';
import Pay from './pages/Pay';
import Receive from './pages/Receive';
import Privacy from './pages/Privacy';
import Demo from './pages/Demo';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/create" element={<Create />} />
          <Route path="/pay" element={<Pay />} />
          <Route path="/receive" element={<Receive />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/demo" element={<Demo />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
