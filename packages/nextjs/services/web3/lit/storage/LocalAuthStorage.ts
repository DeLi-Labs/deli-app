import type { IAuthStorage } from "./storage";
import { AuthStorageError } from "./storage";
import type { AuthData } from "@lit-protocol/schemas";

export class LocalStorageError extends AuthStorageError {
  constructor(message: string) {
    super(message);
    this.name = "LocalStorageError";
  }
}

export class NoAuthenticationDataError extends AuthStorageError {
  constructor(message: string) {
    super(message);
    this.name = "NoAuthenticationDataError";
  }
}

export class AuthenticationDataExpiredError extends AuthStorageError {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationDataExpiredError";
  }
}

export class LocalAuthStorage implements IAuthStorage {
  private readonly storageKey: string;
  private readonly expiryKey: string;
  private readonly expiryDuration: number;

  constructor(storageKey: string, expiryKey: string, expiryDuration: number) {
    this.storageKey = storageKey;
    this.expiryKey = expiryKey;
    this.expiryDuration = expiryDuration;
  }

  get(): Promise<AuthData> {
    if (typeof window === "undefined") {
      throw new LocalStorageError("LocalAuthStorage is only available in the browser");
    }

    const storedAuthData = localStorage.getItem(this.storageKey);
    const storedExpiry = localStorage.getItem(this.expiryKey);

    if (!storedAuthData || !storedExpiry) {
      this.delete();
      throw new NoAuthenticationDataError("No authentication data found");
    }

    const expiryTime = parseInt(storedExpiry, 10);
    if (Date.now() > expiryTime) {
      throw new AuthenticationDataExpiredError("Authentication data expired");
    }

    return Promise.resolve(JSON.parse(storedAuthData) as AuthData);
  }

  set(value: AuthData): Promise<void> {
    if (typeof window === "undefined") {
      throw new LocalStorageError("LocalAuthStorage is only available in the browser");
    }

    const expiryTime = Date.now() + this.expiryDuration;
    localStorage.setItem(this.storageKey, JSON.stringify(value));
    localStorage.setItem(this.expiryKey, expiryTime.toString());
    return Promise.resolve();
  }

  delete(): Promise<void> {
    if (typeof window === "undefined") {
      throw new LocalStorageError("LocalAuthStorage is only available in the browser");
    }

    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.expiryKey);
    return Promise.resolve();
  }
}
