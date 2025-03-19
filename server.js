const express = require('express');
const WebSocket = require('ws');
const session = require('express-session');
const { checkWin, isBoardFull, minimax } = require('./gameLogic');
const { handleMultiplayer, broadcastGameState } = require('./multiplayer');
const { joinTournament, endTournamentMatch } = require('./tournament');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'tic-tac-toe-secret',
  resave: false,
  saveUninitialized: true
}));

let players = {};
let games = {};

const getAvailableGames = () => {
  return Object.entries(games)
    .filter(([_, g]) => g.mode === 'multiplayer' && g.status === 'waiting')
    .map(([gameId, game]) => ({ gameId, playerX: game.playerX }));
};

app.get('/', (req, res) => {
  res.render('index', { error: null });
});

app.post('/menu', (req, res) => {
  const nick = req.body.nick;
  if (!nick) {
    res.render('index', { error: 'Por favor, insira um nick' });
    return;
  }
  if (!players[nick]) {
    players[nick] = { wins: 0, points: 0, totalTime: 0, tournamentWins: 0 };
  }
  req.session.nick = nick;
  const availableGames = getAvailableGames();
  res.render('menu', { nick, availableGames, players, error: null, message: null });
});

app.post('/start', (req, res) => {
  const nick = req.session.nick;
  const mode = req.body.mode;
  if (!nick) {
    res.render('index', { error: 'Sessão expirada. Insira seu nick novamente.' });
    return;
  }
  
  const gameId = Date.now().toString();
  games[gameId] = {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    playerX: nick,
    playerO: mode === 'multiplayer' ? null : 'AI',
    mode: mode,
    status: mode === 'multiplayer' ? 'waiting' : 'playing',
    clients: [],
    lastActivity: Date.now(),
    startTime: Date.now(),
    message: mode === 'multiplayer' ? 'Esperando oponente...' : null
  };
  
  res.render('game', { 
    game: games[gameId], 
    message: games[gameId].message,
    gameId,
    nick
  });
});

app.post('/join/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  const nick = req.session.nick;
  const game = games[gameId];
  
  if (!nick) {
    res.render('index', { error: 'Sessão expirada. Insira seu nick novamente.' });
    return;
  }
  
  if (!game) {
    const availableGames = getAvailableGames();
    res.render('menu', { nick, availableGames, players, error: 'Jogo não encontrado', message: null });
    return;
  }
  
  if (game.status !== 'waiting' || game.playerO) {
    const availableGames = getAvailableGames();
    res.render('menu', { nick, availableGames, players, error: 'Jogo inválido ou já em andamento', message: null });
    return;
  }
  
  if (nick === game.playerX) {
    const availableGames = getAvailableGames();
    res.render('menu', { nick, availableGames, players, error: 'Você não pode jogar contra si mesmo!', message: null });
    return;
  }
  
  if (!players[nick]) {
    players[nick] = { wins: 0, points: 0, totalTime: 0, tournamentWins: 0 };
  }
  
  game.playerO = nick;
  game.status = 'playing';
  game.message = null;
  broadcastGameState(game);
  
  res.render('game', { 
    game, 
    message: null,
    gameId,
    nick
  });
});

app.post('/move/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  const game = games[gameId];
  const position = parseInt(req.body.position);
  const nick = req.session.nick;
  
  if (!game) {
    const availableGames = getAvailableGames();
    res.render('menu', { nick, availableGames, players, error: 'Jogo não encontrado', message: null });
    return;
  }

  if (game.board[position] !== null || 
      (game.mode === 'multiplayer' && !game.playerO) ||
      (game.mode === 'multiplayer' && 
       ((game.currentPlayer === 'X' && nick !== game.playerX) || 
        (game.currentPlayer === 'O' && nick !== game.playerO)))) {
    res.render('game', { 
      game, 
      message: 'Movimento inválido, não é seu turno ou esperando segundo jogador!', 
      gameId,
      nick
    });
    return;
  }

  game.board[position] = game.currentPlayer;
  game.lastActivity = Date.now();
  let message = null;

  if (checkWin(game.board, game.currentPlayer)) {
    const winner = game[`player${game.currentPlayer}`];
    if (players[winner]) {
      players[winner].wins++;
      players[winner].points += 10;
      const timePlayed = (Date.now() - game.startTime) / 1000;
      players[winner].totalTime = (players[winner].totalTime || 0) + timePlayed;
    }
    message = `${winner} venceu!`;
    game.status = 'finished';
    if (game.tournamentId) {
      endTournamentMatch(game.tournamentId, gameId, winner, players, games);
    }
  } else if (isBoardFull(game.board)) {
    message = 'Empate!';
    game.status = 'finished';
    if (game.tournamentId) {
      endTournamentMatch(game.tournamentId, gameId, null, players, games);
    }
  } else {
    game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
    
    if (game.mode === 'single' && game.currentPlayer === 'O' && !message) {
      const bestMove = minimax(game.board, 'O').index;
      game.board[bestMove] = 'O';
      
      if (checkWin(game.board, 'O')) {
        message = 'AI venceu!';
        game.status = 'finished';
      } else if (isBoardFull(game.board)) {
        message = 'Empate!';
        game.status = 'finished';
      }
      game.currentPlayer = 'X';
    }
  }

  game.message = message;
  broadcastGameState(game);

  res.render('game', { 
    game, 
    message, 
    gameId,
    nick
  });
});

app.get('/restart/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  const game = games[gameId];
  const nick = req.session.nick;
  
  if (!game) {
    const availableGames = getAvailableGames();
    res.render('menu', { nick, availableGames, players, error: 'Jogo não encontrado', message: null });
    return;
  }

  const newGameId = Date.now().toString();
  games[newGameId] = {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    playerX: game.playerX,
    playerO: game.mode === 'multiplayer' ? game.playerO : 'AI',
    mode: game.mode,
    status: game.mode === 'multiplayer' ? 'playing' : 'playing',
    clients: game.clients,
    lastActivity: Date.now(),
    startTime: Date.now(),
    message: null
  };
  
  delete games[gameId];
  broadcastGameState(games[newGameId]);

  res.render('game', { 
    game: games[newGameId], 
    message: null,
    gameId: newGameId,
    nick
  });
});

app.post('/tournament', (req, res) => {
  const nick = req.session.nick;
  if (!nick) {
    res.render('index', { error: 'Sessão expirada. Insira seu nick novamente.' });
    return;
  }
  joinTournament(nick, players);
  const availableGames = getAvailableGames();
  res.render('menu', { nick, availableGames, players, error: null, message: 'Você entrou na fila do torneio!' });
});

handleMultiplayer(wss, games, players);

server.listen(port, () => {
  console.log(`Jogo rodando em http://localhost:${port}`);
});