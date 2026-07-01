import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import AddApplication from './pages/AddApplication.jsx';
import AllApplications from './pages/AllApplications.jsx';
import Search from './pages/Search.jsx';
import InterviewNotes from './pages/InterviewNotes.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="add" element={<AddApplication />} />
        <Route path="applications" element={<AllApplications />} />
        <Route path="search" element={<Search />} />
        <Route path="interview-notes" element={<InterviewNotes />} />
      </Route>
    </Routes>
  );
}
