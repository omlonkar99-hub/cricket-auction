import { createSignal, createEffect, onMount, Show, Switch, Match } from 'solid-js';
import Login from './components/Login';

const ROUTE_KEY = 'app_route';
import HomePage from './components/HomePage';
import AdminLogin from './components/AdminLogin';
import AuctionBrowser from './components/AuctionBrowser';
import DashboardHome from './components/DashboardHome';
import AuctionContainer from './components/AuctionContainer';
import CreateAuction from './components/CreateAuction';
import JoinAuction from './components/JoinAuction';
import UsernamePrompt from './components/UsernamePrompt';

function App() {
  const [currentPage, setCurrentPage] = createSignal('home');
  const [selectedAuction, setSelectedAuction] = createSignal(null);
  const [currentUser, setCurrentUser] = createSignal(null);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const [showLogin, setShowLogin] = createSignal(false);

  onMount(() => {
    // Parse current URL path
    const path = window.location.pathname;
    
    // Check if admin is logged in
    const adminToken = localStorage.getItem('adminToken');
    const adminUsername = localStorage.getItem('adminUsername');
    
    // Route based on URL
    if (path === '/admin/login') {
      setCurrentPage('adminLogin');
    } else if (path === '/dashboard') {
      // Protect dashboard - require login
      if (!adminToken || !adminUsername) {
        window.location.href = '/admin/login';
        return;
      }
      setCurrentPage('adminDashboard');
    } else if (path.includes('/browse')) {
      setCurrentPage('auctionBrowser');
    } else if (path.includes('/create')) {
      setCurrentPage('createAuction');
    } else {
      setCurrentPage('home');
    }

    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    const teamIdRaw = localStorage.getItem('teamId');

    if (token && username && role) {
      const user = { username, role, token };
      if (role === 'team' && teamIdRaw != null && teamIdRaw !== '') {
        // Keep teamId as string to handle large int64 values (MongoDB ObjectIds)
        user.teamId = String(teamIdRaw);
      }
      setCurrentUser(user);
      setIsAuthenticated(true);
    }
  });
  createEffect(() => {
    const page = currentPage();
    const auction = selectedAuction();
    sessionStorage.setItem(ROUTE_KEY, JSON.stringify({
      page,
      auctionId: page === 'auction' && auction ? auction.id : null,
      auctionName: page === 'auction' && auction ? auction.name : null,
      auctionData: page === 'editAuction' && auction ? auction : null
    }));
  });

  const handleLogin = (userData) => {
    setCurrentUser(userData);
    setIsAuthenticated(true);
    setShowLogin(false);
    setCurrentPage('home'); // 
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('teamId');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    sessionStorage.removeItem(ROUTE_KEY);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setCurrentPage('home');
    setSelectedAuction(null);
    window.location.href = '/';
  };

  const handleNavigate = (page, auctionData) => {
    // Update URL based on page
    if (page === 'home') {
      window.history.pushState({}, '', '/');
    } else if (page === 'adminLogin') {
      window.history.pushState({}, '', '/admin/login');
    } else if (page === 'adminDashboard') {
      window.history.pushState({}, '', '/dashboard');
    } else if (page === 'auctionBrowser') {
      window.history.pushState({}, '', '/browse');
    } else if (page === 'createAuction') {
      window.history.pushState({}, '', '/create');
    }
    
    if ((page === 'dashboard' || page === 'editAuction') && !isAuthenticated()) {
      setShowLogin(true);
      return;
    }
    
    setCurrentPage(page);
    
    if (page === 'retentionAuction' && auctionData) {
      setSelectedAuction({
        ...auctionData,
        id: auctionData.id != null ? String(auctionData.id) : auctionData.id
      });
    }
    if (page === 'auction' && auctionData) {
      setSelectedAuction({
        ...auctionData,
        id: auctionData.id != null ? String(auctionData.id) : auctionData.id
      });
      window.history.pushState({}, '', `/auction/${auctionData.id}`);
    }
    if (page === 'joinAuction' && auctionData) {
      setSelectedAuction({
        ...auctionData,
        id: auctionData.id != null ? String(auctionData.id) : auctionData.id
      });
    }
    if (page === 'editAuction' && auctionData) {
      setSelectedAuction({
        ...auctionData,
        id: auctionData.id != null ? String(auctionData.id) : auctionData.id
      });
    }
  };

  const handleLoginRequest = () => {
    setShowLogin(true);
  };

  return (
    <>
      <UsernamePrompt />
      
      <Show when={showLogin()}>
        <Login 
          onLogin={handleLogin} 
          onClose={() => setShowLogin(false)}
        />
      </Show>
      
      <Switch fallback={<div>Loading...</div>}>
        <Match when={currentPage() === 'adminLogin'}>
          <AdminLogin />
        </Match>
        
        <Match when={currentPage() === 'adminDashboard'}>
          <DashboardHome 
            onNavigate={handleNavigate} 
            currentUser={currentUser()}
            onLogout={handleLogout}
          />
        </Match>
        
        <Match when={currentPage() === 'auctionBrowser'}>
          <AuctionBrowser
            onNavigate={handleNavigate}
            onBack={() => handleNavigate('home')}
          />
        </Match>
        
        <Match when={currentPage() === 'joinAuction' && selectedAuction()}>
          <JoinAuction
            auctionId={selectedAuction().id}
            onJoinSuccess={() => {
              setCurrentPage('auction');
            }}
            onBack={() => setCurrentPage('auctionBrowser')}
          />
        </Match>
        
        <Match when={currentPage() === 'createAuction'}>
          <CreateAuction
            onNavigate={handleNavigate}
            onBack={() => setCurrentPage('home')}
          />
        </Match>
        
        <Match when={currentPage() === 'auction' && selectedAuction()}>
          <AuctionContainer
            auctionId={selectedAuction().id}
            onBack={() => setCurrentPage('auctionBrowser')}
          />
        </Match>
        
        <Match when={currentPage() === 'editAuction' && selectedAuction()}>
          <CreateAuction
            mode="edit"
            initialData={selectedAuction()}
            onBack={() => setCurrentPage('auctions')}
          />
        </Match>
        
        <Match when={currentPage() === 'dashboard'}>
          <DashboardHome 
            onNavigate={handleNavigate} 
            currentUser={currentUser()}
            onLogout={handleLogout}
          />
        </Match>
        
        <Match when={currentPage() === 'auctions'}>
          <AuctionBrowser
            onNavigate={handleNavigate}
            onBack={() => setCurrentPage('home')}
          />
        </Match>
        
        <Match when={currentPage() === 'home'}>
          <HomePage 
            onNavigate={handleNavigate} 
            currentUser={currentUser()}
            isAuthenticated={isAuthenticated()}
            onLoginRequest={handleLoginRequest}
          />
        </Match>
      </Switch>
    </>
  );
}

export default App;
