export interface User {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  userId: string;
  token: string;
  expiresAt: Date;
}

export type FamilyMember = "Juan" | "Marina" | "Judith";

export interface PinAuthRequest {
  userId: string;
  pin: string; // 4-digit PIN
}

export interface AuthResponse {
  token: string;
  user: User;
}
