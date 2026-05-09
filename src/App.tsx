import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ParticipantDashboard from './pages/ParticipantDashboard';
import FacilitatorDashboard from './pages/FacilitatorDashboard';
import { useAuth } from './lib/firebase';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route 
          path="/participant" 
          element={
            <AuthGuard>
              <ParticipantDashboard />
            </AuthGuard>
          } 
        />
        <Route 
          path="/facilitator" 
          element={
            <AuthGuard>
              <FacilitatorDashboard />
            </AuthGuard>
          } 
        />
      </Routes>
    </Router>
  );
}
