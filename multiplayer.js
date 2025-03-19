const WebSocket = require('ws');
const { checkWin, isBoardFull, minimax } = require('./gameLogic');

const broadcastGameState = (game) => {
  game.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'game',
        board: game.board,
        currentPlayer: game.currentPlayer,
        message: game.message || null,
        status: game.status,
        playerX: game.playerX,
        playerO: game.playerO
      }));
    }
  });
};

const broadcastChatMessage = (game, sender, message) => {
  game.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'chat',
        sender,
        message
      }));
    }
  });
};

const handleMultiplayer = (wss, games, players) => {
  wss.on('connection', (ws, req) => {
    const urlParts = req.url.split('?');
    const gameId = urlParts[0].split('/')[2];
    const query = urlParts[1] || '';
    const nick = new URLSearchParams(query).get('nick');
    const game = games[gameId];
    
    if (game && nick) {
      const existingClientIndex = game.clients.findIndex(client => client.nick === nick);
      if (existingClientIndex !== -1) {
        game.clients.splice(existingClientIndex, 1);
      }
      
      if (game.clients.length >= 2 && game.playerX !== nick && game.playerO !== nick) {
        ws.close(1000, 'Sala cheia');
        return;
      }

      ws.nick = nick;
      game.clients.push(ws);
      game.lastActivity = Date.now();

      broadcastGameState(game);

      ws.on('message', (data) => {
        const parsedData = JSON.parse(data);
        if (parsedData.type === 'chat') {
          broadcastChatMessage(game, ws.nick, parsedData.message);
        }
      });

      ws.on('close', () => {
        game.clients = game.clients.filter(client => client !== ws);
        
        if (game.mode === 'multiplayer' && game.status === 'playing' && game.clients.length < 2) {
          const closedNick = ws.nick;
          const remainingPlayer = closedNick === game.playerX ? game.playerO : game.playerX;
          
          if (remainingPlayer && players[remainingPlayer]) {
            players[remainingPlayer].wins++;
            players[remainingPlayer].points += 10;
            const timePlayed = (Date.now() - game.startTime) / 1000; // Tempo em segundos
            players[remainingPlayer].totalTime = (players[remainingPlayer].totalTime || 0) + timePlayed;
            game.status = 'finished';
            game.message = `${remainingPlayer} venceu por desistência do adversário!`;
            broadcastGameState(game);
          }
        } else if (game.mode === 'multiplayer' && game.status === 'waiting') {
          game.message = 'Esperando oponente...';
          broadcastGameState(game);
        }
      });

      ws.on('pong', () => {
        game.lastActivity = Date.now();
      });
    }
  });

  setInterval(() => {
    const now = Date.now();
    Object.keys(games).forEach(gameId => {
      const game = games[gameId];
      if (now - game.lastActivity > 30 * 1000) {
        game.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.ping();
          }
        });
      }
      if (now - game.lastActivity > 5 * 60 * 1000) {
        delete games[gameId];
      }
    });
  }, 10 * 1000);
};

module.exports = { handleMultiplayer, broadcastGameState };