export interface PixReceiver {
  key: string;
  name: string;
  city: string;
}

export function crc16(_payload: string): string {
  return '';
}

export function pixCode(_receiver: PixReceiver, _charge: { amount?: number; txid: string }): string {
  return '';
}

export function manipulationTxid(_id: string): string {
  return '';
}
