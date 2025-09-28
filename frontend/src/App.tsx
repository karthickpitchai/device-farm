import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DeviceList from './pages/DeviceList';
import DeviceDetail from './pages/DeviceDetail';
import Sessions from './pages/Sessions';
import Analytics from './pages/Analytics';
import Automation from './pages/Automation';
import { SocketProvider } from './hooks/useSocket';

function App() {
  return (
    <SocketProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<DeviceList />} />
          <Route path="/devices/:deviceId" element={<DeviceDetail />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/automation" element={<Automation />} />
        </Routes>
      </Layout>
    </SocketProvider>
  );
}

export default App;