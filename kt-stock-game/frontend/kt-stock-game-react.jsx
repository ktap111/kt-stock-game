import React, { useState, useEffect, useRef } from 'react';

const KT_STOCK_GAME = () => {
  const [screen, setScreen] = useState('welcome');
  const [user, setUser] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [ktRankings, setKtRankings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStock, setSelectedStock] = useState(null);
  const [shares, setShares] = useState(1);
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [errors, setErrors] = useState([]);
  const [testMode, setTestMode] = useState(false);
  const [tickerSearch, setTickerSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [apiError, setApiError] = useState(null);

  const searchInputRef = useRef(null);

  const API_BASE_URL = 'https://kt-stock-api.onrender.com';
  
  // Game constants from spec
  const MIN_HOLDINGS = 4;
  const MAX_HOLDINGS = 10;
  const MIN_INVESTED_PCT = 97;
  const MAX_POSITION_PCT = 25;
  
  const POPULAR_STOCKS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM', 'V', 'WMT',
    'DIS', 'NFLX', 'BA', 'KO', 'PEP', 'NKE', 'MCD', 'SBUX', 'COST', 'HD'
  ];

  const COMPANY_NAMES = {
    'AAPL': 'Apple',
    'MSFT': 'Microsoft',
    'GOOGL': 'Google',
    'AMZN': 'Amazon',
    'NVDA': 'NVIDIA',
    'TSLA': 'Tesla',
    'META': 'Meta',
    'JPM': 'JPMorgan Chase',
    'V': 'Visa',
    'WMT': 'Walmart',
    'DIS': 'Disney',
    'NFLX': 'Netflix',
    'BA': 'Boeing',
    'KO': 'Coca-Cola',
    'PEP': 'PepsiCo',
    'NKE': 'Nike',
    'MCD': 'McDonald\'s',
    'SBUX': 'Starbucks',
    'COST': 'Costco',
    'HD': 'Home Depot'
  };

  const SECTORS = [
    'Technology', 'Healthcare', 'Financial', 'Consumer', 'Energy',
    'Industrial', 'Materials', 'Utilities', 'Real Estate', 'Communications'
  ];

  // Helper functions for game rules
  const calculateInvestedPct = (portfolio) => {
    if (!portfolio || portfolio.totalValue === 0) return 0;
    const holdingsValue = portfolio.holdings.reduce((sum, h) => sum + h.value, 0);
    return (holdingsValue / portfolio.totalValue) * 100;
  };

  const getPositionPct = (holding, portfolioValue) => {
    if (!portfolioValue || portfolioValue === 0) return 0;
    return (holding.value / portfolioValue) * 100;
  };

  const isBuyable = (stock, portfolioValue) => {
    // Stock is buyable if one share costs <= 25% of portfolio
    return stock.price <= (portfolioValue * (MAX_POSITION_PCT / 100));
  };

  const canBuyStock = (stock, numShares, portfolio) => {
    const cost = stock.price * numShares;
    
    // Check cash
    if (cost > portfolio.cash) {
      return { allowed: false, reason: '💰 Not enough cash!' };
    }

    // Check max holdings (if new stock)
    const existingHolding = portfolio.holdings.find(h => h.symbol === stock.symbol);
    if (!existingHolding && portfolio.holdings.length >= MAX_HOLDINGS) {
      return { allowed: false, reason: `📦 Maximum ${MAX_HOLDINGS} stocks allowed` };
    }

    // Check 25% position cap
    const newPositionValue = existingHolding 
      ? existingHolding.value + cost
      : cost;
    const newPositionPct = (newPositionValue / portfolio.totalValue) * 100;
    
    if (newPositionPct > MAX_POSITION_PCT) {
      return { allowed: false, reason: `⚠️ Would exceed ${MAX_POSITION_PCT}% position limit (${newPositionPct.toFixed(1)}%)` };
    }

    // If already over 25%, can't add more
    if (existingHolding) {
      const currentPct = getPositionPct(existingHolding, portfolio.totalValue);
      if (currentPct > MAX_POSITION_PCT) {
        return { allowed: false, reason: `🔒 Position is ${currentPct.toFixed(1)}% (max ${MAX_POSITION_PCT}%) - sell first to add more` };
      }
    }

    return { allowed: true };
  };

  // Handle ticker search - triggered by button click
  const handleSearch = () => {
    const searchValue = searchInputRef.current ? searchInputRef.current.value : tickerSearch;
    
    if (searchValue.length === 0) {
      setSearchResults([]);
      return;
    }
    
    console.log('Searching for:', searchValue);
    console.log('KT Rankings available:', ktRankings.length);
    
    const term = searchValue.toUpperCase();
    
    // Search in KT rankings only - no fake stocks
    const ktMatches = ktRankings.filter(stock => 
      stock.symbol.includes(term)
    );
    
    console.log('Matches found:', ktMatches.length);
    
    if (ktMatches.length > 0) {
      setSearchResults(ktMatches.slice(0, 5));
    } else {
      // No matches - show "not found" result
      setSearchResults([{ 
        symbol: term, 
        notFound: true,
        message: `"${term}" not in current game stocks. Available stocks: AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META, JPM, V, WMT, DIS, NFLX, BA, KO, PEP, NKE, MCD, SBUX, COST, HD`
      }]);
    }
  };

  const logError = (location, error, context = {}) => {
    const errorLog = {
      timestamp: new Date().toISOString(),
      location,
      error: error.message || error.toString(),
      context,
      stack: error.stack
    };
    console.error('KT GAME ERROR:', errorLog);
    setErrors(prev => [...prev.slice(-9), errorLog]);
    return errorLog;
  };

  const loadTestData = () => {
    console.log('Loading test data...');
    const testUser = {
      firstName: 'Test',
      lastName: 'Player',
      phone: '5555555555',
      location: 'Test State',
      riskTolerance: 'medium',
      preferredSector: 'Technology',
      returnGoal: 'long'
    };
    
    setUser(testUser);
    
    const testPortfolio = {
      cash: 10000,
      holdings: [],
      totalValue: 10000,
      startValue: 10000,
      gameStarted: false
    };
    
    setPortfolio(testPortfolio);
    generateKTRankings(testUser);
    setScreen('game');
  };

  useEffect(() => {
    loadUserData();
    loadLeaderboard();
  }, []);

  // Update KT rankings every 24 hours (daily)
  useEffect(() => {
    if (user && screen === 'game') {
      const interval = setInterval(() => {
        console.log('Daily refresh: Updating KT rankings...');
        generateKTRankings(user);
      }, 86400000); // 24 hours = 86400000 ms
      return () => clearInterval(interval);
    }
  }, [user, screen]);

  // Update portfolio values every 15 seconds (only if game has started)
  useEffect(() => {
    if (portfolio && screen === 'game' && portfolio.gameStarted) {
      const interval = setInterval(() => {
        updatePortfolioValues();
      }, 15000); // 15 seconds
      return () => clearInterval(interval);
    }
  }, [portfolio, screen]);

  const loadUserData = async () => {
    if (!window.storage) {
      console.log('Storage not available - data will not persist');
      return;
    }
    try {
      const userData = await window.storage.get('kt-user');
      if (userData) {
        const parsedUser = JSON.parse(userData.value);
        console.log('Loaded user:', parsedUser);
        setUser(parsedUser);
        
        const portfolioData = await window.storage.get(`kt-portfolio-${parsedUser.phone}`);
        if (portfolioData) {
          const parsedPortfolio = JSON.parse(portfolioData.value);
          console.log('Loaded portfolio:', parsedPortfolio);
          setPortfolio(parsedPortfolio);
          await generateKTRankings(parsedUser);
          setScreen('game');
        } else {
          const newPortfolio = {
            cash: 10000,
            holdings: [],
            totalValue: 10000,
            startValue: 10000,
            gameStarted: false
          };
          console.log('Creating new portfolio for existing user');
          setPortfolio(newPortfolio);
          await window.storage.set(`kt-portfolio-${parsedUser.phone}`, JSON.stringify(newPortfolio));
          await generateKTRankings(parsedUser);
          setScreen('game');
        }
      } else {
        console.log('No existing user data found');
      }
    } catch (error) {
      logError('loadUserData', error);
    }
  };

  const loadLeaderboard = async () => {
    if (!window.storage) {
      console.log('Storage not available for leaderboard');
      return;
    }
    try {
      const leaderboardData = await window.storage.get('kt-leaderboard', true);
      if (leaderboardData) {
        const parsed = JSON.parse(leaderboardData.value);
        console.log('Loaded leaderboard:', parsed.length, 'entries');
        setLeaderboard(parsed);
      } else {
        console.log('No leaderboard data found');
      }
    } catch (error) {
      logError('loadLeaderboard', error);
    }
  };

  const updateLeaderboard = async (userData, portfolioData) => {
    if (!window.storage) {
      console.log('Storage not available - leaderboard not updated');
      return;
    }
    try {
      console.log('Updating leaderboard for:', userData.firstName);
      
      let currentLeaderboard = [];
      try {
        const data = await window.storage.get('kt-leaderboard', true);
        if (data) {
          currentLeaderboard = JSON.parse(data.value);
        }
      } catch (e) {
        console.log('No existing leaderboard, creating new one');
        currentLeaderboard = [];
      }

      const returnPercent = ((portfolioData.totalValue - portfolioData.startValue) / portfolioData.startValue) * 100;
      
      const existingIndex = currentLeaderboard.findIndex(entry => entry.phone === userData.phone);
      const newEntry = {
        name: `${userData.firstName} ${userData.lastName}`,
        phone: userData.phone,
        return: returnPercent,
        value: portfolioData.totalValue
      };

      if (existingIndex >= 0) {
        console.log('Updating existing leaderboard entry');
        currentLeaderboard[existingIndex] = newEntry;
      } else {
        console.log('Adding new leaderboard entry');
        currentLeaderboard.push(newEntry);
      }

      currentLeaderboard.sort((a, b) => b.return - a.return);
      currentLeaderboard = currentLeaderboard.slice(0, 100);

      await window.storage.set('kt-leaderboard', JSON.stringify(currentLeaderboard), true);
      setLeaderboard(currentLeaderboard);
      console.log('Leaderboard updated:', currentLeaderboard.length, 'entries');
    } catch (error) {
      logError('updateLeaderboard', error, { userData, portfolioData });
    }
  };

  const register = async (formData) => {
    try {
      console.log('=== REGISTRATION START ===');
      console.log('Form data:', formData);
      
      const userData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        location: formData.location,
        riskTolerance: formData.riskTolerance,
        preferredSector: formData.preferredSector,
        returnGoal: formData.returnGoal
      };

      console.log('User data created:', userData);

      if (window.storage) {
        try {
          console.log('Saving user to storage...');
          await window.storage.set('kt-user', JSON.stringify(userData));
          console.log('User saved successfully');
        } catch (error) {
          logError('register - save user', error, { userData });
        }
      } else {
        console.warn('Storage not available - user data will not persist');
      }
      
      setUser(userData);
      console.log('User state updated');

      const newPortfolio = {
        cash: 10000,
        holdings: [],
        totalValue: 10000,
        startValue: 10000,
        gameStarted: false
      };
      
      console.log('Portfolio created:', newPortfolio);
      setPortfolio(newPortfolio);
      
      if (window.storage) {
        try {
          console.log('Saving portfolio to storage...');
          await window.storage.set(`kt-portfolio-${userData.phone}`, JSON.stringify(newPortfolio));
          console.log('Portfolio saved successfully');
        } catch (error) {
          logError('register - save portfolio', error, { newPortfolio });
        }
      }
      
      console.log('Generating KT rankings...');
      await generateKTRankings(userData);
      console.log('KT rankings generated');
      
      console.log('Moving to game screen');
      setScreen('game');
      console.log('=== REGISTRATION COMPLETE ===');
    } catch (error) {
      logError('register', error, { formData });
      alert('❌ Registration failed: ' + error.message);
    }
  };

  // Hardcoded KT sentiment/technical/leadership baselines per stock
  const KT_BASELINES = {
    'NVDA': { sentiment: 92, technical: 88, leadership: 95 },
    'AAPL': { sentiment: 85, technical: 82, leadership: 90 },
    'MSFT': { sentiment: 88, technical: 85, leadership: 92 },
    'GOOGL': { sentiment: 80, technical: 78, leadership: 85 },
    'AMZN': { sentiment: 82, technical: 80, leadership: 88 },
    'TSLA': { sentiment: 75, technical: 70, leadership: 82 },
    'META': { sentiment: 78, technical: 75, leadership: 80 },
    'NFLX': { sentiment: 72, technical: 68, leadership: 75 },
    'V': { sentiment: 70, technical: 72, leadership: 78 },
    'JPM': { sentiment: 68, technical: 70, leadership: 75 },
    'WMT': { sentiment: 65, technical: 68, leadership: 72 },
    'DIS': { sentiment: 60, technical: 58, leadership: 68 },
    'KO': { sentiment: 62, technical: 60, leadership: 70 },
    'PEP': { sentiment: 63, technical: 62, leadership: 68 },
    'MCD': { sentiment: 61, technical: 59, leadership: 65 },
    'NKE': { sentiment: 58, technical: 55, leadership: 62 },
    'SBUX': { sentiment: 56, technical: 54, leadership: 60 },
    'BA': { sentiment: 52, technical: 50, leadership: 58 },
    'COST': { sentiment: 66, technical: 64, leadership: 70 },
    'HD': { sentiment: 64, technical: 62, leadership: 68 }
  };

  const generateKTRankings = async (userData) => {
    try {
      console.log('Generating KT rankings for:', userData);

      // Fetch real stock data from the backend API
      const symbolsParam = POPULAR_STOCKS.join(',');
      const response = await fetch(`${API_BASE_URL}/api/stocks?symbols=${symbolsParam}`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setApiError(null); // Clear any previous error on success

      console.log('API returned', data.stocks.length, 'stocks');

      const rankings = data.stocks
        .filter(stock => stock.price != null) // Skip any stocks that failed to load
        .map(stock => {
          const baseline = KT_BASELINES[stock.symbol] || { sentiment: 60, technical: 60, leadership: 60 };
          let sentiment = baseline.sentiment;
          let technical = baseline.technical;
          let leadership = baseline.leadership;

          // Adjust technical score based on real daily change from API
          if (stock.changePercent != null) {
            technical = Math.max(0, Math.min(100, technical + stock.changePercent * 2));
          }

          // Apply user preference adjustments
          if (userData.riskTolerance === 'high') {
            technical += 5;
          } else if (userData.riskTolerance === 'low') {
            leadership += 5;
          }

          if (userData.returnGoal === 'short') {
            technical += 3;
          } else {
            leadership += 3;
          }

          const ktValue = sentiment * 0.4 + technical * 0.35 + leadership * 0.25;

          return {
            symbol: stock.symbol,
            name: stock.name,
            ktValue,
            sentiment,
            technical,
            leadership,
            price: stock.price,
            change: stock.change ?? 0,
            changePercent: stock.changePercent ?? 0
          };
        });

      rankings.sort((a, b) => b.ktValue - a.ktValue);

      console.log('Generated', rankings.length, 'KT rankings with live prices');
      setKtRankings(rankings);
      return rankings;
    } catch (error) {
      logError('generateKTRankings', error, { userData });
      console.warn('API fetch failed, falling back to cached rankings if available');
      setApiError('Could not reach the stock API. Showing last known data. Make sure the backend is running on http://127.0.0.1:8000');

      // If we already have rankings, keep them so the UI isn't empty
      if (ktRankings.length > 0) {
        console.log('Keeping', ktRankings.length, 'cached rankings');
        return ktRankings;
      }
      return [];
    }
  };

  const updatePortfolioValues = async () => {
    if (!portfolio || !user) {
      console.log('Cannot update portfolio - missing data');
      return;
    }

    try {
      console.log('Updating portfolio values...');

      // Build a list of held symbols and fetch their current prices from the API
      const heldSymbols = portfolio.holdings.map(h => h.symbol);
      let priceMap = {};

      if (heldSymbols.length > 0) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/stocks?symbols=${heldSymbols.join(',')}`);
          if (response.ok) {
            const data = await response.json();
            data.stocks.forEach(s => {
              if (s.price != null) {
                priceMap[s.symbol] = s.price;
              }
            });
            setApiError(null);
          } else {
            console.warn('API returned', response.status, '- using last known prices');
          }
        } catch (fetchError) {
          console.warn('Could not reach API for portfolio update:', fetchError.message);
          setApiError('Could not reach the stock API. Prices may be stale. Make sure the backend is running on http://127.0.0.1:8000');
        }
      }

      const updatedHoldings = portfolio.holdings.map(holding => {
        // Use real price from API if available, otherwise keep the last known price
        const newPrice = priceMap[holding.symbol] ?? holding.currentPrice;
        return {
          ...holding,
          currentPrice: newPrice,
          value: newPrice * holding.shares,
          changePercent: ((newPrice - holding.purchasePrice) / holding.purchasePrice) * 100
        };
      });

      const holdingsValue = updatedHoldings.reduce((sum, h) => sum + h.value, 0);
      const totalValue = portfolio.cash + holdingsValue;

      const updatedPortfolio = {
        ...portfolio,
        holdings: updatedHoldings,
        totalValue
      };

      console.log('New total value:', totalValue);
      setPortfolio(updatedPortfolio);

      if (window.storage) {
        try {
          await window.storage.set(`kt-portfolio-${user.phone}`, JSON.stringify(updatedPortfolio));
        } catch (error) {
          logError('updatePortfolioValues - save', error);
        }
      }

      await updateLeaderboard(user, updatedPortfolio);

      if (totalValue <= 20) {
        console.log('GAME OVER - Portfolio value:', totalValue);
        setScreen('gameOver');
      }

      await generateKTRankings(user);
    } catch (error) {
      logError('updatePortfolioValues', error);
    }
  };

  const buyStock = async (stock, numShares) => {
    try {
      console.log('=== BUY STOCK ===');
      console.log('Stock:', stock.symbol, 'Shares:', numShares, 'Price:', stock.price);
      
      // Check all constraints using helper function
      const canBuy = canBuyStock(stock, numShares, portfolio);
      if (!canBuy.allowed) {
        alert(canBuy.reason);
        return;
      }

      const cost = stock.price * numShares;
      console.log('Total cost:', cost, 'Available cash:', portfolio.cash);

      const existingHolding = portfolio.holdings.find(h => h.symbol === stock.symbol);
      let updatedHoldings;

      if (existingHolding) {
        console.log('Adding to existing position');
        updatedHoldings = portfolio.holdings.map(h => 
          h.symbol === stock.symbol
            ? {
                ...h,
                shares: h.shares + numShares,
                value: (h.shares + numShares) * stock.price,
                currentPrice: stock.price,
                purchasePrice: ((h.purchasePrice * h.shares) + (stock.price * numShares)) / (h.shares + numShares)
              }
            : h
        );
      } else {
        console.log('Creating new position');
        updatedHoldings = [
          ...portfolio.holdings,
          {
            symbol: stock.symbol,
            shares: numShares,
            purchasePrice: stock.price,
            currentPrice: stock.price,
            value: cost,
            changePercent: 0
          }
        ];
      }

      const holdingsValue = updatedHoldings.reduce((sum, h) => sum + h.value, 0);
      const updatedPortfolio = {
        ...portfolio,
        cash: portfolio.cash - cost,
        holdings: updatedHoldings,
        totalValue: portfolio.cash - cost + holdingsValue
      };

      console.log('Updated portfolio:', updatedPortfolio);
      setPortfolio(updatedPortfolio);
      
      if (window.storage) {
        try {
          await window.storage.set(`kt-portfolio-${user.phone}`, JSON.stringify(updatedPortfolio));
          console.log('Portfolio saved');
        } catch (error) {
          logError('buyStock - save', error);
        }
      }
      
      await updateLeaderboard(user, updatedPortfolio);
      
      setSelectedStock(null);
      setShares(1);
      console.log('=== BUY COMPLETE ===');
    } catch (error) {
      logError('buyStock', error);
      alert('❌ Purchase failed: ' + error.message);
    }
  };

  const sellStock = async (holding) => {
    try {
      console.log('=== SELL STOCK ===');
      console.log('Selling:', holding.symbol, holding.shares, 'shares at', holding.currentPrice);
      
      const saleValue = holding.currentPrice * holding.shares;
      console.log('Sale value:', saleValue);
      
      const updatedHoldings = portfolio.holdings.filter(h => h.symbol !== holding.symbol);
      const holdingsValue = updatedHoldings.reduce((sum, h) => sum + h.value, 0);
      
      const updatedPortfolio = {
        ...portfolio,
        cash: portfolio.cash + saleValue,
        holdings: updatedHoldings,
        totalValue: portfolio.cash + saleValue + holdingsValue
      };

      console.log('Updated portfolio:', updatedPortfolio);
      setPortfolio(updatedPortfolio);
      
      if (window.storage) {
        try {
          await window.storage.set(`kt-portfolio-${user.phone}`, JSON.stringify(updatedPortfolio));
          console.log('Portfolio saved');
        } catch (error) {
          logError('sellStock - save', error, { holding });
        }
      }
      
      await updateLeaderboard(user, updatedPortfolio);
      console.log('=== SELL COMPLETE ===');
    } catch (error) {
      logError('sellStock', error, { holding });
      alert('❌ Sale failed: ' + error.message);
    }
  };

  const resetGame = async () => {
    if (!user) {
      console.error('Cannot reset - no user');
      return;
    }
    
    try {
      console.log('=== RESETTING GAME ===');
      
      const newPortfolio = {
        cash: 10000,
        holdings: [],
        totalValue: 10000,
        startValue: 10000,
        gameStarted: false
      };
      
      setPortfolio(newPortfolio);
      
      if (window.storage) {
        try {
          await window.storage.set(`kt-portfolio-${user.phone}`, JSON.stringify(newPortfolio));
          console.log('Portfolio reset in storage');
        } catch (error) {
          logError('resetGame - save', error);
        }
      }
      
      await generateKTRankings(user);
      await updateLeaderboard(user, newPortfolio);
      setScreen('game');
      console.log('=== GAME RESET COMPLETE ===');
    } catch (error) {
      logError('resetGame', error);
      alert('❌ Reset failed: ' + error.message);
    }
  };

  const startGame = async () => {
    if (!portfolio || portfolio.holdings.length < MIN_HOLDINGS) {
      alert(`📦 You need at least ${MIN_HOLDINGS} stocks to start!`);
      return;
    }

    if (portfolio.holdings.length > MAX_HOLDINGS) {
      alert(`📦 You can't have more than ${MAX_HOLDINGS} stocks!`);
      return;
    }

    try {
      console.log('=== STARTING GAME ===');
      
      const updatedPortfolio = {
        ...portfolio,
        gameStarted: true,
        startValue: portfolio.totalValue
      };

      setPortfolio(updatedPortfolio);

      if (window.storage) {
        try {
          await window.storage.set(`kt-portfolio-${user.phone}`, JSON.stringify(updatedPortfolio));
          console.log('Game started - portfolio saved');
        } catch (error) {
          logError('startGame - save', error);
        }
      }

      console.log('=== GAME STARTED ===');
      alert(`🎮 Game started with ${portfolio.holdings.length} stocks! Prices update every 15 seconds. Good luck!`);
    } catch (error) {
      logError('startGame', error);
      alert('❌ Failed to start game: ' + error.message);
    }
  };

  const DebugPanel = () => {
    if (!debugMode) return null;
    
    return (
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        width: '350px',
        maxHeight: '80vh',
        background: 'rgba(0, 0, 0, 0.95)',
        color: '#0f0',
        borderRadius: '10px',
        padding: '15px',
        fontFamily: 'monospace',
        fontSize: '12px',
        overflowY: 'auto',
        zIndex: 10000,
        boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '2px solid #0f0', paddingBottom: '10px' }}>
          <h4 style={{ margin: 0, fontSize: '16px' }}>🔧 Debug Panel</h4>
          <button onClick={() => setDebugMode(false)} style={{ background: '#f00', color: 'white', border: 'none', width: '25px', height: '25px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
        </div>
        
        <div style={{ marginBottom: '15px', border: '1px solid #0f0', padding: '10px', borderRadius: '5px' }}>
          <h5 style={{ margin: '0 0 8px 0', color: '#ff0', fontSize: '14px' }}>Screen State</h5>
          <div>{screen}</div>
        </div>
        
        {user && (
          <div style={{ marginBottom: '15px', border: '1px solid #0f0', padding: '10px', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 8px 0', color: '#ff0', fontSize: '14px' }}>User Data</h5>
            <pre style={{ margin: 0, fontSize: '11px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(user, null, 2)}</pre>
          </div>
        )}
        
        {errors.length > 0 && (
          <div style={{ border: '1px solid #f00', padding: '10px', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 8px 0', color: '#ff0', fontSize: '14px' }}>Recent Errors ({errors.length})</h5>
            {errors.slice(-3).map((err, i) => (
              <div key={i} style={{ background: 'rgba(255, 0, 0, 0.1)', padding: '8px', marginBottom: '8px', borderRadius: '3px', borderLeft: '3px solid #f00' }}>
                <div style={{ color: '#ff0', fontWeight: 'bold', marginBottom: '3px' }}>{err.location}</div>
                <div style={{ color: '#f00', marginBottom: '3px' }}>{err.error}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const WelcomeScreen = () => (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: '120px', marginBottom: '20px', animation: 'bounce 2s infinite' }}>🚀</div>
      <h1 style={{ fontSize: '48px', color: '#667eea', marginBottom: '10px', textShadow: '3px 3px 0 #ffd700' }}>KT Stock Game</h1>
      <p style={{ fontSize: '24px', color: '#666', marginBottom: '40px' }}>Learn to invest with $10,000 play money!</p>
      
      {/* Core Rules */}
      <div style={{ background: '#f8f8f8', border: '3px solid #667eea', borderRadius: '20px', padding: '30px', marginBottom: '30px', textAlign: 'left', maxWidth: '600px', margin: '0 auto 30px auto' }}>
        <h2 style={{ fontSize: '28px', color: '#667eea', marginBottom: '20px', textAlign: 'center' }}>📋 The Rules (Just 3!)</h2>
        <div style={{ fontSize: '18px', lineHeight: '1.8', color: '#333' }}>
          <div style={{ marginBottom: '20px', padding: '15px', background: 'white', borderRadius: '10px', border: '2px solid #667eea' }}>
            <strong style={{ color: '#667eea' }}>1. Pick 4-10 US stocks</strong>
            <div style={{ fontSize: '16px', color: '#666', marginTop: '5px' }}>Build your portfolio with any US stocks</div>
          </div>
          <div style={{ marginBottom: '20px', padding: '15px', background: 'white', borderRadius: '10px', border: '2px solid #667eea' }}>
            <strong style={{ color: '#667eea' }}>2. Stay ≥97% invested</strong>
            <div style={{ fontSize: '16px', color: '#666', marginTop: '5px' }}>Keep cash low (whole shares only)</div>
          </div>
          <div style={{ marginBottom: '0', padding: '15px', background: 'white', borderRadius: '10px', border: '2px solid #667eea' }}>
            <strong style={{ color: '#667eea' }}>3. Max 25% per stock</strong>
            <div style={{ fontSize: '16px', color: '#666', marginTop: '5px' }}>No single stock can exceed 25% of your portfolio at purchase</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '40px', flexWrap: 'wrap' }}>
        <div style={{ background: '#ffd700', padding: '15px 30px', borderRadius: '20px', fontSize: '20px', fontWeight: 'bold', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }}>📊 Real stocks</div>
        <div style={{ background: '#ffd700', padding: '15px 30px', borderRadius: '20px', fontSize: '20px', fontWeight: 'bold', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }}>🎯 Smart KT rankings</div>
        <div style={{ background: '#ffd700', padding: '15px 30px', borderRadius: '20px', fontSize: '20px', fontWeight: 'bold', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }}>🏆 Compete with friends</div>
      </div>
      <button 
        onClick={() => setScreen('register')}
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', padding: '20px 50px', borderRadius: '50px', fontSize: '28px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontFamily: 'Comic Sans MS, cursive', marginBottom: '20px' }}
      >
        Let's Play! 🎮
      </button>
      
      <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button onClick={loadTestData} style={{ background: '#333', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '10px', fontSize: '16px', cursor: 'pointer', fontFamily: 'Comic Sans MS, cursive' }}>
          🧪 Test Mode (Skip Registration)
        </button>
        <button onClick={() => setDebugMode(!debugMode)} style={{ background: '#333', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '10px', fontSize: '16px', cursor: 'pointer', fontFamily: 'Comic Sans MS, cursive' }}>
          🔧 {debugMode ? 'Hide' : 'Show'} Debug Panel
        </button>
      </div>
    </div>
  );

  const RegisterScreen = () => {
    const [formData, setFormData] = useState({
      firstName: '',
      lastName: '',
      phone: '',
      location: '',
      riskTolerance: 'medium',
      preferredSector: 'Technology',
      returnGoal: 'long'
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.phone.match(/^\d{10}$/)) {
        alert('📱 Please enter a 10-digit phone number');
        return;
      }
      register(formData);
    };

    return (
      <div>
        <h2 style={{ fontSize: '36px', color: '#667eea', marginBottom: '30px', textAlign: 'center' }}>👋 Let's Get Started!</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>First Name</label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
              placeholder="Your first name"
              style={{ width: '100%', padding: '15px', border: '3px solid #667eea', borderRadius: '15px', fontSize: '18px', fontFamily: 'Comic Sans MS, cursive' }}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>Last Name</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
              placeholder="Your last name"
              style={{ width: '100%', padding: '15px', border: '3px solid #667eea', borderRadius: '15px', fontSize: '18px', fontFamily: 'Comic Sans MS, cursive' }}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>📱 Phone Number</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})}
              placeholder="1234567890"
              maxLength="10"
              style={{ width: '100%', padding: '15px', border: '3px solid #667eea', borderRadius: '15px', fontSize: '18px', fontFamily: 'Comic Sans MS, cursive' }}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>🌎 State or Country</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              placeholder="e.g., California or USA"
              style={{ width: '100%', padding: '15px', border: '3px solid #667eea', borderRadius: '15px', fontSize: '18px', fontFamily: 'Comic Sans MS, cursive' }}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>🎲 Risk Tolerance</label>
            <select
              value={formData.riskTolerance}
              onChange={(e) => setFormData({...formData, riskTolerance: e.target.value})}
              style={{ width: '100%', padding: '15px', border: '3px solid #667eea', borderRadius: '15px', fontSize: '18px', fontFamily: 'Comic Sans MS, cursive' }}
            >
              <option value="low">😌 Low - Play it safe</option>
              <option value="medium">😊 Medium - Balanced</option>
              <option value="high">🚀 High - Go big!</option>
            </select>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>🏭 Favorite Sector</label>
            <select
              value={formData.preferredSector}
              onChange={(e) => setFormData({...formData, preferredSector: e.target.value})}
              style={{ width: '100%', padding: '15px', border: '3px solid #667eea', borderRadius: '15px', fontSize: '18px', fontFamily: 'Comic Sans MS, cursive' }}
            >
              {SECTORS.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>⏰ Investment Goal</label>
            <select
              value={formData.returnGoal}
              onChange={(e) => setFormData({...formData, returnGoal: e.target.value})}
              style={{ width: '100%', padding: '15px', border: '3px solid #667eea', borderRadius: '15px', fontSize: '18px', fontFamily: 'Comic Sans MS, cursive' }}
            >
              <option value="short">⚡ Short Term (under 6 months)</option>
              <option value="long">🌱 Long Term (over 12 months)</option>
            </select>
          </div>

          <button type="submit" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', padding: '20px 50px', borderRadius: '50px', fontSize: '28px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontFamily: 'Comic Sans MS, cursive', width: '100%' }}>Start Playing! 🎉</button>
        </form>
      </div>
    );
  };

  const GameScreen = () => {
    const returnPercent = ((portfolio.totalValue - portfolio.startValue) / portfolio.startValue) * 100;
    const holdingsValue = portfolio.holdings.reduce((sum, h) => sum + h.value, 0);

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '32px', color: '#667eea' }}>👋 Hi {user.firstName}!</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setDebugMode(!debugMode)} style={{ background: '#333', color: 'white', border: 'none', width: '45px', height: '45px', borderRadius: '50%', fontSize: '20px', cursor: 'pointer' }}>🔧</button>
            <button onClick={() => setShowLeaderboard(!showLeaderboard)} style={{ background: '#ffd700', border: 'none', padding: '15px 30px', borderRadius: '20px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Comic Sans MS, cursive' }}>🏆 Leaderboard</button>
          </div>
        </div>

        {apiError && (
          <div style={{ background: '#fff3e0', border: '2px solid #ff9800', borderRadius: '15px', padding: '15px 20px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div style={{ flex: 1, fontSize: '14px', color: '#e65100' }}>{apiError}</div>
            <button onClick={() => setApiError(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#e65100' }}>✕</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', padding: '20px', borderRadius: '20px', textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>💰 Cash</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${portfolio.cash.toFixed(2)}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)', padding: '20px', borderRadius: '20px', textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>📈 Stocks</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${holdingsValue.toFixed(2)}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', padding: '20px', borderRadius: '20px', textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>💎 Total</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${portfolio.totalValue.toFixed(2)}</div>
          </div>
          <div style={{ background: returnPercent >= 0 ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)', padding: '20px', borderRadius: '20px', textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>📊 Return</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{returnPercent >= 0 ? '📈' : '📉'} {returnPercent.toFixed(2)}%</div>
          </div>
        </div>

        {/* Game Status Banner */}
        {!portfolio.gameStarted && (
          <div style={{ background: '#ffd700', padding: '20px', borderRadius: '20px', marginBottom: '20px', border: '3px solid #667eea' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>
              🎯 Select {MIN_HOLDINGS}-{MAX_HOLDINGS} stocks to start! ({portfolio.holdings.length}/{MAX_HOLDINGS})
            </div>
            {portfolio.holdings.length >= MIN_HOLDINGS && portfolio.holdings.length <= MAX_HOLDINGS && (
              <button 
                onClick={startGame}
                style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                  color: 'white', 
                  border: 'none', 
                  padding: '15px 40px', 
                  borderRadius: '25px', 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer', 
                  fontFamily: 'Comic Sans MS, cursive',
                  boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                  animation: 'pulse 2s infinite'
                }}
              >
                🚀 START GAME! 🚀
              </button>
            )}
          </div>
        )}

        {portfolio.gameStarted && (
          <div>
            <div style={{ background: '#11998e', padding: '15px', borderRadius: '15px', marginBottom: '10px', color: 'white' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>
                ⚡ Game Active! Prices updating every 15 seconds
              </div>
            </div>
            {(() => {
              const investedPct = calculateInvestedPct(portfolio);
              const isCompliant = investedPct >= MIN_INVESTED_PCT;
              return (
                <div style={{ 
                  background: isCompliant ? '#e8f5e9' : '#fff3e0',
                  padding: '15px', 
                  borderRadius: '15px', 
                  marginBottom: '20px',
                  border: `3px solid ${isCompliant ? '#4caf50' : '#ff9800'}`
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', marginBottom: '5px' }}>
                    💼 Invested: {investedPct.toFixed(1)}% {isCompliant ? '✅' : '⚠️'}
                  </div>
                  {!isCompliant && (
                    <div style={{ fontSize: '14px', color: '#f57c00' }}>
                      Target: ≥{MIN_INVESTED_PCT}% invested (keep cash low!)
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Ticker Search */}
        <div style={{ marginBottom: '30px', background: '#f8f8f8', padding: '25px', borderRadius: '20px', border: '3px solid #667eea' }}>
          <h3 style={{ fontSize: '24px', color: '#667eea', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🔍 Search Any Stock
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Type ticker symbol (e.g., AAPL, TSLA, GOOG...)"
              defaultValue=""
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              style={{ 
                flex: 1,
                padding: '15px', 
                border: '3px solid #667eea', 
                borderRadius: '15px', 
                fontSize: '20px', 
                fontFamily: 'Comic Sans MS, cursive'
              }}
            />
            <button
              onClick={() => {
                if (searchInputRef.current) {
                  setTickerSearch(searchInputRef.current.value);
                  handleSearch();
                }
              }}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '15px',
                fontSize: '20px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: 'Comic Sans MS, cursive',
                whiteSpace: 'nowrap'
              }}
            >
              🔍 Search
            </button>
          </div>
          
          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              {searchResults.map((stock) => {
                // Handle "not found" result
                if (stock.notFound) {
                  return (
                    <div 
                      key={stock.symbol}
                      style={{ 
                        background: '#fff3e0',
                        padding: '20px', 
                        borderRadius: '15px', 
                        border: '2px solid #ff9800'
                      }}
                    >
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f57c00', marginBottom: '10px' }}>
                        ❌ "{stock.symbol}" Not Found
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.5' }}>
                        {stock.message}
                      </div>
                    </div>
                  );
                }
                
                // Regular stock result
                return (
                  <div 
                    key={stock.symbol} 
                    onClick={() => {
                      setSelectedStock(stock);
                      setSearchResults([]);
                      if (searchInputRef.current) {
                        searchInputRef.current.value = '';
                      }
                    }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '15px', 
                      background: 'white', 
                      padding: '15px', 
                      borderRadius: '15px', 
                      cursor: 'pointer', 
                      border: '2px solid #667eea'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                        {stock.symbol}
                        <span style={{ fontSize: '16px', color: '#999', fontWeight: 'normal', marginLeft: '8px' }}>
                          {COMPANY_NAMES[stock.symbol] || ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '16px', color: '#666' }}>${stock.price.toFixed(2)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#667eea', marginBottom: '5px' }}>KT: {stock.ktValue.toFixed(0)}</div>
                      <div style={{ background: '#e0e0e0', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', height: '100%', width: `${stock.ktValue}%` }}></div>
                      </div>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#667eea' }}>
                      Click to Buy →
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showLeaderboard && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '30px', padding: '30px', maxWidth: '500px', width: '100%', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
              <button onClick={() => setShowLeaderboard(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: '#ff6a00', color: 'white', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              <h3 style={{ fontSize: '32px', color: '#667eea', marginBottom: '20px', textAlign: 'center' }}>🏆 Top Players</h3>
              <div>
                {leaderboard.map((entry, index) => (
                  <div key={entry.phone} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: entry.phone === user.phone ? '#ffd700' : '#f8f8f8', marginBottom: '10px', borderRadius: '15px', border: entry.phone === user.phone ? '3px solid #667eea' : 'none' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea', minWidth: '40px' }}>#{index + 1}</div>
                    <div style={{ flex: 1, fontSize: '20px', fontWeight: 'bold' }}>{entry.name}</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: entry.return >= 0 ? '#11998e' : '#eb3349' }}>
                      {entry.return >= 0 ? '+' : ''}{entry.return.toFixed(2)}%
                    </div>
                  </div>
                ))}
                {leaderboard.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontSize: '18px' }}>Be the first on the leaderboard!</div>}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '28px', color: '#667eea', marginBottom: '15px' }}>📦 My Stocks ({portfolio.holdings.length}/10)</h3>
          {portfolio.holdings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: '#f0f0f0', borderRadius: '20px', fontSize: '20px', color: '#666' }}>
              <p>You don't own any stocks yet!</p>
              <p>👇 Check out the KT Rankings below to get started</p>
            </div>
          ) : (
            <div className="holdings-list">
              {portfolio.holdings.map(holding => {
                const positionPct = getPositionPct(holding, portfolio.totalValue);
                const isOverLimit = positionPct > MAX_POSITION_PCT;
                return (
                  <div key={holding.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f8f8', padding: '20px', borderRadius: '20px', border: `3px solid ${isOverLimit ? '#ff9800' : '#667eea'}` }}>
                    <div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                        {holding.symbol}
                        <span style={{ fontSize: '16px', color: '#999', fontWeight: 'normal', marginLeft: '8px' }}>
                          {COMPANY_NAMES[holding.symbol] || ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '16px', color: '#666' }}>{holding.shares} shares</div>
                      <div style={{ fontSize: '14px', color: isOverLimit ? '#f57c00' : '#999', fontWeight: isOverLimit ? 'bold' : 'normal' }}>
                        {positionPct.toFixed(1)}% of portfolio {isOverLimit && '⚠️'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>${holding.currentPrice.toFixed(2)}</div>
                      <div style={{ fontSize: '16px', color: holding.changePercent >= 0 ? '#11998e' : '#eb3349' }}>
                        {holding.changePercent >= 0 ? '📈' : '📉'} {holding.changePercent.toFixed(2)}%
                      </div>
                    </div>
                    <button onClick={() => sellStock(holding)} style={{ background: '#ff6a00', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Comic Sans MS, cursive' }}>Sell All 💵</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '28px', color: '#667eea', margin: 0 }}>⭐ Top KT Stocks</h3>
            <div style={{ background: '#f0f0f0', padding: '8px 15px', borderRadius: '10px', fontSize: '14px', color: '#667eea', fontWeight: 'bold', border: '2px solid #667eea' }}>
              🔄 Rankings refresh daily
            </div>
          </div>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '5px', textAlign: 'center' }}>
            KT Score = Sentiment (40%) + Technicals (35%) + Leadership (25%)
          </p>
          <p style={{ fontSize: '12px', color: '#999', marginBottom: '15px', textAlign: 'center', fontStyle: 'italic' }}>
            Showing buyable stocks only (max 25% of portfolio per position)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
            {ktRankings.filter(stock => isBuyable(stock, portfolio.totalValue)).slice(0, 20).map((stock, index) => (
              <div key={stock.symbol} onClick={() => setSelectedStock(stock)} style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#f8f8f8', padding: '15px', borderRadius: '15px', cursor: 'pointer', border: '2px solid transparent' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#667eea', minWidth: '40px' }}>#{index + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                    {stock.symbol}
                    <span style={{ fontSize: '14px', color: '#999', fontWeight: 'normal', marginLeft: '8px' }}>
                      {stock.name || COMPANY_NAMES[stock.symbol] || ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '16px', color: '#666' }}>${stock.price.toFixed(2)}</div>
                </div>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#667eea', marginBottom: '5px' }}>KT: {stock.ktValue.toFixed(0)}</div>
                  <div style={{ background: '#e0e0e0', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', height: '100%', width: `${stock.ktValue}%`, transition: 'width 0.3s' }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedStock && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '30px', padding: '30px', maxWidth: '500px', width: '100%', position: 'relative' }}>
              <button onClick={() => setSelectedStock(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: '#ff6a00', color: 'white', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              <h3 style={{ fontSize: '32px', color: '#667eea', marginBottom: '20px', textAlign: 'center' }}>
                📊 {selectedStock.symbol}
                <div style={{ fontSize: '18px', color: '#999', fontWeight: 'normal', marginTop: '5px' }}>
                  {COMPANY_NAMES[selectedStock.symbol] || ''}
                </div>
              </h3>
              
              <div style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#f8f8f8', marginBottom: '10px', borderRadius: '15px', fontSize: '20px' }}>
                  <span>Price:</span>
                  <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea' }}>${selectedStock.price.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#f8f8f8', marginBottom: '10px', borderRadius: '15px', fontSize: '20px' }}>
                  <span>KT Score:</span>
                  <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffd700' }}>{selectedStock.ktValue.toFixed(0)}/100</span>
                </div>
                
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f0f0f0', marginBottom: '8px', borderRadius: '10px', fontSize: '18px' }}>
                    <span>😊 Sentiment</span>
                    <span>{selectedStock.sentiment.toFixed(0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f0f0f0', marginBottom: '8px', borderRadius: '10px', fontSize: '18px' }}>
                    <span>📈 Technical</span>
                    <span>{selectedStock.technical.toFixed(0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f0f0f0', marginBottom: '8px', borderRadius: '10px', fontSize: '18px' }}>
                    <span>👑 Leadership</span>
                    <span>{selectedStock.leadership.toFixed(0)}</span>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>How many shares?</label>
                <input
                  key={selectedStock.symbol}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Enter number of shares"
                  value={shares > 0 ? shares : ''}
                  onChange={(e) => {
                    // Only allow numbers
                    const value = e.target.value.replace(/\D/g, '');
                    setShares(value === '' ? 0 : parseInt(value));
                  }}
                  style={{ width: '100%', padding: '15px', border: '3px solid #667eea', borderRadius: '15px', fontSize: '20px', marginBottom: '15px', fontFamily: 'Comic Sans MS, cursive' }}
                />
                <div style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', color: '#667eea', marginBottom: '20px' }}>
                  Total: ${shares > 0 ? (selectedStock.price * shares).toFixed(2) : '0.00'}
                </div>
                <button
                  onClick={() => buyStock(selectedStock, shares)}
                  disabled={shares === 0 || portfolio.holdings.length >= 10 || portfolio.cash < selectedStock.price * shares}
                  style={{ 
                    background: (shares === 0 || portfolio.holdings.length >= 10 || portfolio.cash < selectedStock.price * shares) ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                    color: 'white', 
                    border: 'none', 
                    padding: '20px 50px', 
                    borderRadius: '50px', 
                    fontSize: '28px', 
                    fontWeight: 'bold', 
                    cursor: (shares === 0 || portfolio.holdings.length >= 10 || portfolio.cash < selectedStock.price * shares) ? 'not-allowed' : 'pointer', 
                    fontFamily: 'Comic Sans MS, cursive', 
                    width: '100%' 
                  }}
                >
                  {portfolio.holdings.length >= 10 ? '❌ Max 10 Stocks' : shares === 0 ? 'Enter shares to buy' : `Buy ${shares} shares! 💰`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const GameOverScreen = () => (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: '120px', marginBottom: '20px' }}>😢</div>
      <h1 style={{ fontSize: '48px', color: '#667eea', marginBottom: '10px' }}>Game Over!</h1>
      <p style={{ fontSize: '24px', color: '#666', marginBottom: '40px' }}>Your portfolio dropped below $20</p>
      <div style={{ background: '#f8f8f8', padding: '30px', borderRadius: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '24px', marginBottom: '15px' }}>
          <span>Final Value:</span>
          <span style={{ fontWeight: 'bold' }}>${portfolio.totalValue.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '24px' }}>
          <span>Total Return:</span>
          <span style={{ fontWeight: 'bold', color: ((portfolio.totalValue - portfolio.startValue) / portfolio.startValue) * 100 >= 0 ? '#11998e' : '#eb3349' }}>
            {(((portfolio.totalValue - portfolio.startValue) / portfolio.startValue) * 100).toFixed(2)}%
          </span>
        </div>
      </div>
      <button onClick={resetGame} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', padding: '20px 50px', borderRadius: '50px', fontSize: '28px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontFamily: 'Comic Sans MS, cursive' }}>
        Play Again! 🔄
      </button>
    </div>
  );

  return (
    <div style={{ fontFamily: 'Comic Sans MS, Chalkboard SE, Comic Neue, cursive', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
      
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '30px', padding: '30px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {screen === 'welcome' && <WelcomeScreen />}
        {screen === 'register' && <RegisterScreen />}
        {screen === 'game' && <GameScreen />}
        {screen === 'gameOver' && <GameOverScreen />}
      </div>
      
      <DebugPanel />
    </div>
  );
};

export default KT_STOCK_GAME;
