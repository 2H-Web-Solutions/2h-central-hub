import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Tasks from './pages/Tasks';
import Agents from './pages/Agents';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';

import { Toaster } from 'react-hot-toast';

function App() {
    return (
        <>
            <Toaster position="top-right" />
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:projectId" element={<ProjectDetails />} />
            </Routes>
        </>
    );
}

export default App;
