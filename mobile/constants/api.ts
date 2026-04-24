import { Platform } from 'react-native';

// Your machine's LAN IP (confirmed: 192.168.1.67)
const LAN_IP = '192.168.1.73';

// 10.0.2.2 = Android emulator only. Physical device MUST use LAN IP.
export const BASE_URL = `http://${LAN_IP}:3000`;

export const API_URL = `${BASE_URL}/api`;

console.log('[API] BASE_URL =', BASE_URL);
