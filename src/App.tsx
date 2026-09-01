import { BrowserRouter, Route, Routes } from 'react-router-dom';
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
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
