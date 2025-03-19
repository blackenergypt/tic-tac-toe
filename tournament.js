let tournamentQueue = [];
let activeTournaments = {};

const joinTournament = (nick, players) => {
  if (!tournamentQueue.includes(nick)) {
    tournamentQueue.push(nick);
    if (!players[nick]) {
      players[nick] = { wins: 0, points: 0, totalTime: 0, tournamentWins: 0 };
    }
  }
  if (tournamentQueue.length >= 2) {
    startTournament(tournamentQueue.splice(0, 2), players);
  }
};

const startTournament = (participants, players) => {
  const tournamentId = Date.now().toString();
  activeTournaments[tournamentId] = {
    participants,
    currentRound: 0,
    matches: [{ playerX: participants[0], playerO: participants[1], gameId: null }],
    winners: [],
    status: 'ongoing'
  };
  createTournamentMatch(tournamentId, 0);
};

const createTournamentMatch = (tournamentId, matchIndex) => {
  const tournament = activeTournaments[tournamentId];
  const match = tournament.matches[matchIndex];
  const gameId = Date.now().toString();
  match.gameId = gameId;
  return gameId;
};

const endTournamentMatch = (tournamentId, gameId, winner, players, games) => {
  const tournament = activeTournaments[tournamentId];
  const match = tournament.matches.find(m => m.gameId === gameId);
  if (winner) {
    tournament.winners.push(winner);
  }
  if (tournament.matches.length === tournament.winners.length) {
    const champion = tournament.winners[0];
    players[champion].tournamentWins = (players[champion].tournamentWins || 0) + 1;
    players[champion].points += 50;
    delete activeTournaments[tournamentId];
  }
};

module.exports = { joinTournament, endTournamentMatch };