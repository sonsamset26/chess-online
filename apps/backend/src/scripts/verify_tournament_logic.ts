import { TournamentService } from '../modules/tournament/tournament.service';
import { ITournament } from '../modules/tournament/tournament.model';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('--- TEST 1: Compute Result for 4-Player Tournament (Champion) ---');
const tournament4pChampion: Partial<ITournament> = {
  size: 4,
  status: 'FINISHED',
  championId: 'user_A',
  rounds: [
    {
      roundNumber: 1,
      matches: [
        { matchId: 'm1', player1: 'user_A', player2: 'user_B', winnerId: 'user_A', status: 'DONE' },
        { matchId: 'm2', player1: 'user_C', player2: 'user_D', winnerId: 'user_C', status: 'DONE' },
      ],
    },
    {
      roundNumber: 2,
      matches: [
        { matchId: 'm3', player1: 'user_A', player2: 'user_C', winnerId: 'user_A', status: 'DONE' },
      ],
    },
  ],
};

const resChampion = TournamentService.computeMyResult(tournament4pChampion as ITournament, 'user_A');
assert(resChampion.isChampion === true, 'user_A is champion');
assert(resChampion.placement === 1, 'user_A placement is 1');
assert(resChampion.wins === 2, 'user_A wins 2 matches');
assert(resChampion.losses === 0, 'user_A has 0 losses');
assert(resChampion.roundReached === 2, 'user_A reached round 2');

console.log('--- TEST 2: Compute Result for 4-Player Tournament (Runner-up) ---');
const resRunnerUp = TournamentService.computeMyResult(tournament4pChampion as ITournament, 'user_C');
assert(resRunnerUp.isChampion === false, 'user_C is not champion');
assert(resRunnerUp.placement === 2, 'user_C placement is 2 (Runner-up)');
assert(resRunnerUp.wins === 1, 'user_C wins 1 match');
assert(resRunnerUp.losses === 1, 'user_C has 1 loss');
assert(resRunnerUp.roundReached === 2, 'user_C reached round 2 (Chung kết)');

console.log('--- TEST 3: Compute Result for 4-Player Tournament (Semi-finalist) ---');
const resSemi = TournamentService.computeMyResult(tournament4pChampion as ITournament, 'user_B');
assert(resSemi.isChampion === false, 'user_B is not champion');
assert(resSemi.placement === 3, 'user_B placement is 3 (Semi-finalist)');
assert(resSemi.wins === 0, 'user_B wins 0 matches');
assert(resSemi.losses === 1, 'user_B has 1 loss');
assert(resSemi.roundReached === 1, 'user_B reached round 1');

console.log('--- TEST 4: Compute Result for 8-Player Tournament (Top 8 - Quaterfinalist) ---');
const tournament8p: Partial<ITournament> = {
  size: 8,
  status: 'FINISHED',
  championId: 'user_1',
  rounds: [
    {
      roundNumber: 1,
      matches: [
        { matchId: 'm1', player1: 'user_1', player2: 'user_2', winnerId: 'user_1', status: 'DONE' },
        { matchId: 'm2', player1: 'user_3', player2: 'user_4', winnerId: 'user_3', status: 'DONE' },
        { matchId: 'm3', player1: 'user_5', player2: 'user_6', winnerId: 'user_5', status: 'DONE' },
        { matchId: 'm4', player1: 'user_7', player2: 'user_8', winnerId: 'user_7', status: 'DONE' },
      ],
    },
    {
      roundNumber: 2,
      matches: [
        { matchId: 'm5', player1: 'user_1', player2: 'user_3', winnerId: 'user_1', status: 'DONE' },
        { matchId: 'm6', player1: 'user_5', player2: 'user_7', winnerId: 'user_5', status: 'DONE' },
      ],
    },
    {
      roundNumber: 3,
      matches: [
        { matchId: 'm7', player1: 'user_1', player2: 'user_5', winnerId: 'user_1', status: 'DONE' },
      ],
    },
  ],
};

const resTop8 = TournamentService.computeMyResult(tournament8p as ITournament, 'user_2');
assert(resTop8.placement === 5, 'user_2 placement is 5 (Top 5-8)');
assert(resTop8.roundName === 'Tứ kết', 'user_2 round name is Tứ kết');

const resTop4 = TournamentService.computeMyResult(tournament8p as ITournament, 'user_3');
assert(resTop4.placement === 3, 'user_3 placement is 3 (Top 3-4 / Bán kết)');
assert(resTop4.roundName === 'Bán kết', 'user_3 round name is Bán kết');

console.log('--- TEST 5: Compute Result for IN_PROGRESS Tournament (Eliminated in Round 1) ---');
const tournamentInProgress: Partial<ITournament> = {
  size: 4,
  status: 'IN_PROGRESS',
  championId: undefined,
  rounds: [
    {
      roundNumber: 1,
      matches: [
        { matchId: 'm1', player1: 'user_A', player2: 'user_B', winnerId: 'user_A', status: 'DONE' },
        { matchId: 'm2', player1: 'user_C', player2: 'user_D', winnerId: 'user_C', status: 'DONE' },
      ],
    },
  ],
};

const resEliminatedInProgress = TournamentService.computeMyResult(tournamentInProgress as ITournament, 'user_B');
assert(resEliminatedInProgress.isChampion === false, 'user_B is not champion');
assert(resEliminatedInProgress.placement === 3, 'user_B placement is 3 (Semi-finalist) even while IN_PROGRESS');
assert(resEliminatedInProgress.losses === 1, 'user_B has 1 loss');
assert(resEliminatedInProgress.roundName === 'Bán kết', 'user_B round name is Bán kết');

console.log('--- TEST 6: Compute Result for Bye Match (Should NOT count as real win) ---');
const tournamentWithBye: Partial<ITournament> = {
  size: 4,
  status: 'IN_PROGRESS',
  rounds: [
    {
      roundNumber: 1,
      matches: [
        { matchId: null, player1: 'user_A', player2: null, winnerId: 'user_A', status: 'DONE' },
      ],
    },
  ],
};
const resBye = TournamentService.computeMyResult(tournamentWithBye as ITournament, 'user_A');
assert(resBye.wins === 0, 'user_A should have 0 wins from Bye match');

console.log('\n🎉 ALL LOGIC UNIT TESTS PASSED WITH 100% ACCURACY!');
