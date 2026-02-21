"use client";

import { useState } from "react";
import { AddressInput } from "@scaffold-ui/components";
import type { NextPage } from "next";
import toast from "react-hot-toast";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { findValidSalt } from "~~/utils/scaffold-eth/findValidSalt";

type DenominationUnit = "PER_ITEM" | "PER_HOUR" | "PER_DAY" | "PER_BYTE" | "PER_1000_TOKEN";

type FormData = {
  denominationUnit: DenominationUnit;
  denominationAmount: string;
  patentId: string;
  numeraireAddress: string;
  licenseType: "0"; // SingleUse = 0
  price: string;
  totalTokensToSell: string;
};

const UploadCampaignPage: NextPage = () => {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useScaffoldWriteContract("CampaignManager");
  const { data: campaignManagerContract } = useDeployedContractInfo({ contractName: "CampaignManager" });

  const [formData, setFormData] = useState<FormData>({
    denominationUnit: "PER_ITEM",
    denominationAmount: "",
    patentId: "",
    numeraireAddress: "",
    licenseType: "0",
    price: "",
    totalTokensToSell: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      toast.error("Please connect your wallet");
      return;
    }

    // Validate form fields
    if (!formData.denominationAmount) {
      toast.error("Please enter a denomination amount");
      return;
    }

    const amount = parseFloat(formData.denominationAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Denomination amount must be a positive number");
      return;
    }

    if (!formData.patentId) {
      toast.error("Please enter a patent ID");
      return;
    }

    const patentId = BigInt(formData.patentId);
    if (patentId < 0n) {
      toast.error("Patent ID must be a positive number");
      return;
    }

    if (!formData.numeraireAddress) {
      toast.error("Please enter a numeraire address");
      return;
    }

    if (!formData.price) {
      toast.error("Please enter a price");
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      toast.error("Price must be a positive number");
      return;
    }

    if (!formData.totalTokensToSell) {
      toast.error("Please enter total tokens to sell");
      return;
    }

    const totalTokensToSell = parseFloat(formData.totalTokensToSell);
    if (isNaN(totalTokensToSell) || totalTokensToSell <= 0) {
      toast.error("Total tokens to sell must be a positive number");
      return;
    }

    try {
      // Step 1: Upload metadata
      toast.loading("Uploading metadata...", { id: "upload" });

      const formDataToSend = new FormData();
      formDataToSend.append("denominationUnit", formData.denominationUnit);
      formDataToSend.append("denominationAmount", formData.denominationAmount);

      const response = await fetch("/api/campaign", {
        method: "POST",
        body: formDataToSend,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to upload campaign metadata");
      }

      const metadataUri = result.uri;
      toast.success("Metadata uploaded successfully", { id: "upload" });

      // Step 2: Find a valid salt that satisfies Uniswap v4 requirements
      toast.loading("Finding valid salt...", { id: "salt" });

      if (!campaignManagerContract?.address) {
        throw new Error("CampaignManager contract address not found");
      }

      // Get IPERC721 address from deployed contracts
      const chainId = scaffoldConfig.targetNetworks[0].id;
      const chainContracts = (
        deployedContracts as Record<number, Record<string, { address: string; abi: readonly unknown[] }>>
      )[chainId];
      const patentErc721Contract = chainContracts?.IPERC721;
      if (!patentErc721Contract) {
        throw new Error("IPERC721 contract not found");
      }

      const licenseSalt = await findValidSalt(
        formData.numeraireAddress as `0x${string}`,
        metadataUri,
        patentId,
        Number(formData.licenseType),
        patentErc721Contract.address as `0x${string}`,
        campaignManagerContract.address as `0x${string}`,
      );

      toast.success("Valid salt found", { id: "salt" });

      // Step 3: Initialize campaign in CampaignManager
      toast.loading("Initializing campaign...", { id: "initialize" });

      await writeContractAsync({
        functionName: "initialize",
        args: [
          patentId,
          metadataUri,
          licenseSalt,
          formData.numeraireAddress as `0x${string}`,
          Number(formData.licenseType),
          parseUnits(formData.price, 18),
          parseUnits(formData.totalTokensToSell, 18),
        ],
      });

      toast.success("Campaign initialized successfully!", { id: "initialize" });

      // Reset form
      setFormData({
        denominationUnit: "PER_ITEM",
        denominationAmount: "",
        patentId: "",
        numeraireAddress: "",
        licenseType: "0" as const,
        price: "",
        totalTokensToSell: "",
      });
    } catch (error) {
      console.error("Error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload campaign metadata", { id: "upload" });
      toast.error(error instanceof Error ? error.message : "Failed to initialize campaign", { id: "initialize" });
    }
  };

  return (
    <div className="flex items-center flex-col grow pt-10 px-5">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-6">Upload Campaign Metadata</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Denomination Unit Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Denomination Unit</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.denominationUnit}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  denominationUnit: e.target.value as DenominationUnit,
                }))
              }
              required
            >
              <option value="PER_ITEM">Per Item</option>
              <option value="PER_HOUR">Per Hour</option>
              <option value="PER_DAY">Per Day</option>
              <option value="PER_BYTE">Per Byte</option>
              <option value="PER_1000_TOKEN">Per 1000 Token</option>
            </select>
          </div>

          {/* Denomination Amount Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Denomination Amount</span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Value of the denomination per unit"
              className="input input-bordered w-full"
              value={formData.denominationAmount}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  denominationAmount: e.target.value,
                }))
              }
              required
            />
            <label className="label">
              <span className="label-text-alt">Enter the amount value for the selected denomination unit</span>
            </label>
          </div>

          {/* Patent ID Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Patent ID (Token ID)</span>
            </label>
            <input
              type="number"
              min="0"
              placeholder="Enter the patent token ID"
              className="input input-bordered w-full"
              value={formData.patentId}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  patentId: e.target.value,
                }))
              }
              required
            />
          </div>

          {/* Numeraire Address Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Numeraire Address</span>
            </label>
            <AddressInput
              value={formData.numeraireAddress}
              onChange={value =>
                setFormData(prev => ({
                  ...prev,
                  numeraireAddress: value,
                }))
              }
              placeholder="Enter numeraire token address"
            />
          </div>

          {/* License Type Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">License Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.licenseType}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  licenseType: e.target.value as "0",
                }))
              }
              required
            >
              <option value="0">Single Use</option>
            </select>
          </div>

          {/* Price Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Price (in numeraire tokens)</span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Enter the price per license token"
              className="input input-bordered w-full"
              value={formData.price}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  price: e.target.value,
                }))
              }
              required
            />
          </div>

          {/* Total Tokens to Sell Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Total Tokens to Sell</span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Enter total number of license tokens to sell"
              className="input input-bordered w-full"
              value={formData.totalTokensToSell}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  totalTokensToSell: e.target.value,
                }))
              }
              required
            />
          </div>

          {/* Submit Button */}
          <div className="form-control w-full mt-8">
            <button type="submit" className="btn btn-primary w-full" disabled={isPending || !address}>
              {isPending ? (
                <>
                  <span className="loading loading-spinner"></span>
                  Processing...
                </>
              ) : (
                "Submit"
              )}
            </button>
            {!address && (
              <label className="label">
                <span className="label-text-alt text-error">Please connect your wallet to continue</span>
              </label>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadCampaignPage;
