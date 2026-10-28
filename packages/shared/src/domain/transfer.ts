import { Player } from './player.js';

export type TransferListingStatus = 'ACTIVE' | 'SOLD' | 'CANCELLED';

export interface TransferListing {
  id: string;
  clubId: string;
  clubName: string;
  player: Player;
  askingPrice: number;
  status: TransferListingStatus;
  createdAt: string;
}
