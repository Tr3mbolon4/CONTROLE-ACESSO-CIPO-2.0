import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Visitors from './pages/Visitors';
import Fleet from './pages/Fleet';
import Carregamentos from './pages/Carregamentos';
import Employees from './pages/Employees';
import Directors from './pages/Directors';
import Agendamentos from './pages/Agendamentos';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="visitantes" element={<Visitors />} />
            <Route path="frota" element={<Fleet />} />
            <Route path="carregamentos" element={<Carregamentos />} />
            <Route path="funcionarios" element={<Employees />} />
            <Route path="diretoria" element={<Directors />} />
            <Route path="agendamentos" element={<Agendamentos />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="configuracoes" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Settings />
              </ProtectedRoute>
            } />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
