import type { AuthData } from "@lit-protocol/schemas";

export interface ILitAuthenticator {
  authenticate(): Promise<AuthData>;
}
