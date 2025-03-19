function checkWin(board, player) {
    const winConditions = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    return winConditions.some(condition =>
      condition.every(index => board[index] === player)
    );
  }
  
  function isBoardFull(board) {
    return board.every(cell => cell !== null);
  }
  
  function minimax(board, player) {
    const availableSpots = board.reduce((acc, val, idx) => 
      val === null ? [...acc, idx] : acc, []);
  
    if (checkWin(board, 'X')) return { score: -10 };
    if (checkWin(board, 'O')) return { score: 10 };
    if (availableSpots.length === 0) return { score: 0 };
  
    const moves = [];
    for (let i = 0; i < availableSpots.length; i++) {
      const move = {};
      move.index = availableSpots[i];
      const newBoard = [...board];
      newBoard[availableSpots[i]] = player;
  
      if (player === 'O') {
        const result = minimax(newBoard, 'X');
        move.score = result.score;
      } else {
        const result = minimax(newBoard, 'O');
        move.score = result.score;
      }
  
      moves.push(move);
    }
  
    let bestMove;
    if (player === 'O') {
      let bestScore = -Infinity;
      for (let i = 0; i < moves.length; i++) {
        if (moves[i].score > bestScore) {
          bestScore = moves[i].score;
          bestMove = i;
        }
      }
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < moves.length; i++) {
        if (moves[i].score < bestScore) {
          bestScore = moves[i].score;
          bestMove = i;
        }
      }
    }
  
    return moves[bestMove];
  }
  
  module.exports = { checkWin, isBoardFull, minimax };