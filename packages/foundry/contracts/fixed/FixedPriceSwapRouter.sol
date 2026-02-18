// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { V4Router } from "@v4-periphery/V4Router.sol";
import { IV4Router } from "@v4-periphery/interfaces/IV4Router.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { ReentrancyLock } from "@v4-periphery/base/ReentrancyLock.sol";
import { Permit2Forwarder } from "@v4-periphery/base/Permit2Forwarder.sol";
import { Actions } from "@v4-periphery/libraries/Actions.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { IERC20Minimal } from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import { IAllowanceTransfer } from "permit2/src/interfaces/IAllowanceTransfer.sol";
import { FixedPriceLicenseHook } from "./FixedPriceLicenseHook.sol";

contract FixedPriceSwapRouter is V4Router, ReentrancyLock, Permit2Forwarder {
    error PoolHookMismatch(address expected, address actual);
    error Permit2NotApproved(address payer, address token, uint256 amount, uint256 approvedAmount);

    FixedPriceLicenseHook public immutable hook;

    constructor(IPoolManager _poolManager, IAllowanceTransfer _permit2, FixedPriceLicenseHook _hook)
        V4Router(_poolManager)
        Permit2Forwarder(_permit2)
    {
        hook = _hook;
    }

    function msgSender() public view override returns (address) {
        return _getLocker();
    }

    function swapExactOutputSingle(
        PoolKey calldata poolKey,
        uint128 amountOut,
        uint128 amountInMaximum,
        bool zeroForOne,
        bytes calldata hookData,
        IAllowanceTransfer.PermitSingle calldata permitSingle,
        bytes calldata permitSignature
    ) external isNotLocked {
        // Handle Permit2 approval if signature provided
        if (permitSignature.length > 0) {
            address owner = msgSender();
            // Call Permit2 permit - will revert if signature is invalid, expired, or nonce is wrong
            // If permit succeeds, we have approval and can proceed with swap
            permit2.permit(owner, permitSingle, permitSignature);
        }

        // Validate hook
        if (address(poolKey.hooks) != address(hook)) {
            revert PoolHookMismatch(address(hook), address(poolKey.hooks));
        }

        // Encode actions: SWAP_EXACT_OUT_SINGLE, SETTLE_ALL, TAKE_ALL
        bytes memory actions = abi.encodePacked(
            uint8(Actions.SWAP_EXACT_OUT_SINGLE), uint8(Actions.SETTLE_ALL), uint8(Actions.TAKE_ALL)
        );

        // Encode params for each action
        bytes[] memory params = new bytes[](3);

        // SWAP_EXACT_OUT_SINGLE params
        params[0] = abi.encode(
            IV4Router.ExactOutputSingleParams({
                poolKey: poolKey,
                zeroForOne: zeroForOne,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                hookData: hookData
            })
        );

        // SETTLE_ALL params: currency0 (numeraire), maxAmount
        params[1] = abi.encode(poolKey.currency0, amountInMaximum);

        // TAKE_ALL params: currency1 (license token), minAmount
        params[2] = abi.encode(poolKey.currency1, amountOut);

        // Execute - V4Router's _unlockCallback handles the rest
        poolManager.unlock(abi.encode(actions, params));
    }

    function _pay(Currency token, address payer, uint256 amount) internal override {
        if (payer == address(this)) {
            token.transfer(address(poolManager), amount);
        } else {
            address tokenAddress = Currency.unwrap(token);
            // Check if Permit2 is approved
            uint256 allowance = IERC20Minimal(tokenAddress).allowance(payer, address(permit2));
            if (allowance < amount) {
                revert Permit2NotApproved(payer, tokenAddress, amount, allowance);
            }
            permit2.transferFrom(payer, address(poolManager), uint160(amount), tokenAddress);
        }
    }
}
