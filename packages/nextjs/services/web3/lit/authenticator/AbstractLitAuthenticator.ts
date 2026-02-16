import type { ILitAuthenticator } from "./authenticator";
import type { AuthData } from "@lit-protocol/schemas";

export abstract class AbstractLitAuthenticator implements ILitAuthenticator {
  authenticate(): Promise<AuthData> {
    const loginUrl = process.env.NEXT_PUBLIC_LIT_LOGIN_URL;
    if (!loginUrl) {
      throw new Error("NEXT_PUBLIC_LIT_LOGIN_URL is not set");
    }

    return this.impl(loginUrl);
  }

  protected abstract impl(loginUrl: string): Promise<AuthData>;
}
