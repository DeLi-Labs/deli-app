"use client";

import { useEffect, useState } from "react";
import { createLitClient } from "@lit-protocol/lit-client";
import { nagaDev } from "@lit-protocol/networks";
import toast from "react-hot-toast";
import { type PKPInfo, getAuthData, getPKP } from "~~/utils/auth";

type LoginState = "idle" | "initializing" | "authenticating" | "minting" | "success" | "error";

export default function LoginPage() {
  const [state, setState] = useState<LoginState>("idle");
  const [litClient, setLitClient] = useState<any>(null);
  const [pkp, setPkp] = useState<PKPInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize Lit Protocol client (v8 SDK)
  useEffect(() => {
    const initializeLit = async () => {
      try {
        setState("initializing");

        // Create Lit client using v8 SDK with Naga network
        const client = await createLitClient({
          network: nagaDev, // Use nagaDev for testnet
        });

        setLitClient(client);
        setState("idle");
      } catch (err) {
        console.error("Failed to initialize Lit Protocol:", err);
        let errorMessage = "Failed to initialize Lit Protocol";

        if (err instanceof Error) {
          if (err.message.includes("NetworkError") || err.message.includes("fetch")) {
            errorMessage =
              "Network error: Unable to connect to Lit Protocol nodes. Please check your internet connection and try again.";
          } else if (err.message.includes("timeout")) {
            errorMessage = "Connection timeout: Lit Protocol nodes are not responding. Please try again later.";
          } else {
            errorMessage = err.message;
          }
        }

        setError(errorMessage);
        setState("error");
        toast.error(errorMessage);
      }
    };

    initializeLit();
  }, []);

  const handleGoogleSignIn = async () => {
    if (!litClient) {
      toast.error("Lit Protocol not initialized");
      return;
    }

    try {
      setState("authenticating");

      // Get auth data using utility (will authenticate if needed)
      const authData = await getAuthData();
      if (!authData) {
        throw new Error("Failed to authenticate with Google");
      }

      setState("minting");

      // Get PKP using utility function
      const pkpInfo = await getPKP(authData, litClient);

      setPkp(pkpInfo);
      setState("success");

      // Show success message with transaction hash
      let successMessage = "PKP generated successfully!";
      if (pkpInfo.queryableAt) {
        successMessage = "PKP generated and verified on-chain!";
      } else if (pkpInfo.txHash) {
        successMessage = "PKP generated! (Transaction submitted)";
      }
      toast.success(successMessage);
    } catch (err) {
      console.error("Failed to authenticate or mint PKP:", err);
      let errorMessage = "Failed to authenticate or mint PKP";

      if (err instanceof Error) {
        if (err.message.includes("NetworkError") || err.message.includes("fetch")) {
          errorMessage =
            "Network error: Unable to communicate with Lit Protocol. Please check your internet connection and try again.";
        } else if (err.message.includes("timeout")) {
          errorMessage = "Request timeout: The operation took too long. Please try again.";
        } else if (err.message.includes("popup")) {
          errorMessage = "Popup was blocked or closed. Please allow popups and try again.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setState("error");
      toast.error(errorMessage);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-base-100">
      <div className="card bg-base-200 shadow-xl w-full max-w-md">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">Login with Google</h2>

          {state === "success" && pkp && (
            <div className="alert alert-success mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="font-bold">PKP Generated Successfully!</h3>
                <div className="text-xs mt-2">
                  <p className="font-semibold">PKP Public Key:</p>
                  <p className="break-all">{pkp.pubkey}</p>
                  {pkp.ethAddress && (
                    <>
                      <p className="font-semibold mt-2">ETH Address:</p>
                      <p className="break-all">{pkp.ethAddress}</p>
                    </>
                  )}
                  {pkp.txHash && (
                    <>
                      <p className="font-semibold mt-2">Transaction Hash:</p>
                      <a
                        href={`https://yellowstone-explorer.litprotocol.com/tx/${pkp.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-primary hover:underline"
                      >
                        {pkp.txHash}
                      </a>
                    </>
                  )}
                  {pkp.queryableAt && (
                    <>
                      <p className="font-semibold mt-2">Queryable On-Chain:</p>
                      <p className="text-success">Yes (verified at {pkp.queryableAt.toLocaleTimeString()})</p>
                    </>
                  )}
                  {!pkp.queryableAt && pkp.txHash && (
                    <>
                      <p className="font-semibold mt-2">Queryable On-Chain:</p>
                      <p className="text-warning">Not yet (transaction may still be processing)</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="card-actions justify-center mt-4">
            <button
              className={`btn btn-primary btn-lg ${
                state === "authenticating" || state === "minting" || state === "initializing" ? "loading" : ""
              }`}
              onClick={handleGoogleSignIn}
              disabled={
                !litClient ||
                state === "authenticating" ||
                state === "minting" ||
                state === "initializing" ||
                state === "success"
              }
            >
              {state === "initializing" && "Initializing..."}
              {state === "authenticating" && "Authenticating..."}
              {state === "minting" && "Generating PKP..."}
              {(state === "idle" || state === "error") && "Sign in with Google"}
              {state === "success" && "Login Successful"}
            </button>
          </div>

          {state === "success" && (
            <div className="mt-4 text-center">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setState("idle");
                  setPkp(null);
                  setError(null);
                }}
              >
                Sign in with another account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
