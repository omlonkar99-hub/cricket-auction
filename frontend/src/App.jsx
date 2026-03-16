import { createSignal, createEffect, onMount, onCleanup, Show, Switch, Match } from 'solid-js';
import { apiCall } from './utils/api.js';
import Login from './components/Login';

const ROUTE_KEY = 'app_route';
import HomePage from './components/HomePage';
import AuctionsPage from './components/AuctionsPage';
import DashboardHome from './components/DashboardHome';
import AuctionContainer from './components/AuctionContainer';
import RetentionAuctionContainer from './components/RetentionAuctionContainer';
import CreateAuction from './components/CreateAuction';

function App() {
  const [currentPage, setCurrentPage] = createSignal('home');
  const [selectedAuction, setSelectedAuction] = createSignal(null);
  const [currentUser, setCurrentUser] = createSignal(null);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const [showLogin, setShowLogin] = createSignal(false);

  onMount(() => {
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    const teamIdRaw = localStorage.getItem('teamId');

    if (token && username && role) {
      const user = { username, role, token };
      if (role === 'team' && teamIdRaw != null && teamIdRaw !== '') {
        const teamId = Number(teamIdRaw);
        if (!Number.isNaN(teamId)) user.teamId = teamId;
      }
      setCurrentUser(user);
      setIsAuthenticated(true);
      
      // No session validation needed - sessions persist until code/password change
    }

    // Restore last page/auction so refresh keeps user on same interface
    try {
      const saved = sessionStorage.getItem(ROUTE_KEY);
        if (saved) {
          const { page, auctionId, auctionName, auctionData } = JSON.parse(saved);
          if (page && ['home', 'auctions', 'dashboard', 'auction', 'editAuction'].includes(page)) {
            const needAuth = page === 'dashboard' || page === 'editAuction';
            if (needAuth && !token) {
              setCurrentPage('home');
            } else {
              setCurrentPage(page);
              if (page === 'auction' && auctionId != null) {
                setSelectedAuction({ id: String(auctionId), name: auctionName || 'Auction' });
              }
              if (page === 'editAuction' && auctionData) {
                setSelectedAuction({ ...auctionData, id: auctionData?.id != null ? String(auctionData.id) : auctionData?.id });
              }
            }
          }
        }
      } catch (_) {}
  });

  // Session validation - only validate on WebSocket connection for teams
  // No continuous polling - sessions don't expire on inactivity
  
  const validateSessionOnConnect = (token, userRole) => {
    // For teams: validate only when connecting to WebSocket (in auction room)
    // For admins: no validation needed - sessions persist until password change or code change
    // Sessions are invalidated ONLY when:
    // 1. Team code is changed by admin
    // 2. Admin password is changed
    // 3. Admin is deleted
  };

  onCleanup(() => {
    // No session validation cleanup needed
  });

  // Persist route so refresh keeps same interface
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
    setCurrentPage('home'); // Everyone goes to home after login
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('teamId');
    sessionStorage.removeItem(ROUTE_KEY);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setCurrentPage('home');
    setSelectedAuction(null);
  };

  const handleNavigate = (page, auctionData) => {
    // Require login for dashboard and auction editing only
    // Auction viewing is allowed without login (read-only mode)
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
      <Show when={showLogin()}>
        <Login 
          onLogin={handleLogin} 
          onClose={() => setShowLogin(false)}
        />
      </Show>
      
      <Switch fallback={<div>Loading...</div>}>
        <Match when={currentPage() === 'retentionAuction' && selectedAuction()}>
          <RetentionAuctionContainer
            auctionId={selectedAuction().id}
            currentUser={currentUser()}
            isAdmin={String(currentUser()?.role || '').toLowerCase().includes('admin')}
            onBack={() => setCurrentPage('auctions')}
          />
        </Match>
        
        <Match when={currentPage() === 'auction' && selectedAuction()}>
          <AuctionContainer
            auctionId={selectedAuction().id}
            currentUser={currentUser()}
            isAdmin={String(currentUser()?.role || '').toLowerCase().includes('admin')}
            onBack={() => setCurrentPage('auctions')}
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
          <AuctionsPage
            onNavigate={handleNavigate}
            currentUser={currentUser()}
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
