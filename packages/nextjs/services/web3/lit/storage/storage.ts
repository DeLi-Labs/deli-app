import type { AuthData } from "@lit-protocol/schemas";

export class AuthStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthStorageError";
  }
}

export interface IAuthStorage {
  get(): Promise<AuthData>;
  set(value: AuthData): Promise<void>;
  delete(): Promise<void>;
}
