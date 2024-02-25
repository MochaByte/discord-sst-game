export interface Trooper {
  userId: string;
  points: number;
  currentTerritory: string; // Add this line
}

export type LeaderBoard = {
  userId: string;
  points: number;
  territory: string;
};