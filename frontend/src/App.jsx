import { createSignal, createEffect, onMount, onCleanup, Show, Switch, Match } from 'solid-js';
import Login from './components/Login';

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

  // Initialize history state
  const initializeHistoryState = () => {
    const state = window.history.state;
    if (state && state.page) {
      setCurrentPage(state.page);
      if (state.auctionData) {
        setSelectedAuction({
          ...state.auctionData,
          id: state.auctionData.id != null ? String(state.auctionData.id) : state.auctionData.id
        });
      }
    } else {
      // First load - push initial state
      window.history.replaceState({ page: 'home' }, '', '/');
    }
  };

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
    }

    // Initialize history state
    initializeHistoryState();

    // Handle browser back/forward buttons
    const handlePopState = (event) => {
      const state = event.state;
      if (state && state.page) {
        setCurrentPage(state.page);
        if (state.auctionData) {
          setSelectedAuction({
            ...state.auctionData,
            id: state.auctionData.id != null ? String(state.auctionData.id) : state.auctionData.id
          });
        } else {
          setSelectedAuction(null);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    onCleanup(() => window.removeEventListener('popstate', handlePopState));
  });

  // Update URL and history when page changes
  createEffect(() => {
    const page = currentPage();
    const auction = selectedAuction();
    
    let url = '/';
    let state = { page };
    
    switch (page) {
      case 'home':
        url = '/';
        break;
      case 'auctions':
        url = '/auctions';
        break;
      case 'dashboard':
        url = '/dashboard';
        break;
      case 'auction':
        if (auction) {
          url = `/auction/${auction.id}`;
          state.auctionData = auction;
        }
        break;
      case 'retentionAuction':
        if (auction) {
          url = `/retention/${auction.id}`;
          state.auctionData = auction;
        }
        break;
      case 'editAuction':
        if (auction) {
          url = `/auction/${auction.id}/edit`;
          state.auctionData = auction;
        }
        break;
    }
    
    // Push state to history
    window.history.pushState(state, '', url);
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
    setCurrentUser(null);
    setIsAuthenticated(false);
    setCurrentPage('home');
    setSelectedAuction(null);
    window.history.pushState({ page: 'home' }, '', '/');
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
