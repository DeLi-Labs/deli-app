import { AbstractLitAuthenticator } from "../AbstractLitAuthenticator";
import { GoogleAuthenticator } from "@lit-protocol/auth";
import type { AuthData } from "@lit-protocol/schemas";

export class GoogleLitAuthenticator extends AbstractLitAuthenticator {
  protected impl(loginUrl: string): Promise<AuthData> {
    return GoogleAuthenticator.authenticate(loginUrl);
  }
}
