import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/layout/layout';
import { ProtectedRoute } from './components/protected-route';

// Lazy-loaded pages
const Home = lazy(() => import('./pages/home').then(m => ({ default: m.Home })));
const Login = lazy(() => import('./pages/login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/dashboard').then(m => ({ default: m.Dashboard })));
const BankList = lazy(() => import('./pages/bank-list').then(m => ({ default: m.BankList })));
const BankDetail = lazy(() => import('./pages/bank-detail').then(m => ({ default: m.BankDetail })));
const QuestionForm = lazy(() => import('./pages/question-form').then(m => ({ default: m.QuestionForm })));
const PracticeSetup = lazy(() => import('./pages/practice-setup').then(m => ({ default: m.PracticeSetup })));
const PracticeSession = lazy(() => import('./pages/practice-session').then(m => ({ default: m.PracticeSession })));
const Mistakes = lazy(() => import('./pages/mistakes').then(m => ({ default: m.Mistakes })));
const Profile = lazy(() => import('./pages/profile').then(m => ({ default: m.Profile })));
const ChangePassword = lazy(() => import('./pages/change-password').then(m => ({ default: m.ChangePassword })));

function PageLoader() {
  return (
    <div className="page-container flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />

              {/* Routes with layout */}
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/banks" element={<ProtectedRoute><BankList /></ProtectedRoute>} />
                <Route path="/banks/:id" element={<ProtectedRoute><BankDetail /></ProtectedRoute>} />
                <Route path="/banks/:id/questions/new" element={<ProtectedRoute><QuestionForm /></ProtectedRoute>} />
                <Route path="/banks/:id/questions/:qid/edit" element={<ProtectedRoute><QuestionForm /></ProtectedRoute>} />
                <Route path="/practice" element={<ProtectedRoute><PracticeSetup /></ProtectedRoute>} />
                <Route path="/practice/session" element={<ProtectedRoute><PracticeSession /></ProtectedRoute>} />
                <Route path="/mistakes" element={<ProtectedRoute><Mistakes /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
