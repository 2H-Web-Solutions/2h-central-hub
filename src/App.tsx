import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Tasks from './pages/Tasks';
import Agents from './pages/Agents';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Login from './pages/Login';

import { Toaster } from 'react-hot-toast';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
}

function App() {
    return (
        <>
            <Toaster position="top-right" />
            <Routes>
                <Route path="/login" element={<Login />} />
                
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
                <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
                <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
                <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
            </Routes>
        </>
    );
}

export default App;
