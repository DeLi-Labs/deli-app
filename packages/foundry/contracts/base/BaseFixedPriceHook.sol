// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BaseCustomCurve } from "../base/BaseCustomCurve.sol";
import { BaseHook } from "uniswap-hooks/base/BaseHook.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { SwapParams } from "@uniswap/v4-core/src/types/PoolOperation.sol";
import { BalanceDelta } from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { PoolId } from "@v4-core/types/PoolId.sol";
import { PoolKey } from "@v4-core/types/PoolKey.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { CurrencySettler } from "uniswap-hooks/utils/CurrencySettler.sol";

/**
 * @title BaseLicenseHook
 * @notice A Uniswap V4 hook that overrides the AMM with a fixed, updateable price
 * @dev This hook uses BaseCustomCurve to completely bypass the concentrated liquidity
 *      AMM and execute swaps at a specified fixed price ratio.
 *
 *      The price represents how many units of token1 you get per unit of token0.
 *      For example, if price = 2e18, then 1 token0 = 2 token1.
 */
abstract contract BaseFixedPriceHook is BaseCustomCurve, Ownable {
    using CurrencySettler for Currency;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Price must be greater than zero
    error InvalidPrice();

    /// @notice Function not implemented
    error NotImplemented();

    /// @notice Invalid callback data type
    error InvalidCallbackType();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when the price is updated
    event PriceUpdated(PoolId indexed id, uint256 oldPrice, uint256 newPrice);

    /// @notice Emitted when tokens are deposited to the hook
    event Deposited(Currency indexed currency, address indexed depositor, uint256 amount);

    /// @notice Emitted when tokens are withdrawn from the hook
    event Withdrawn(Currency indexed currency, address indexed recipient, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                 CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @dev Callback type for deposit operations
    uint8 internal constant CALLBACK_DEPOSIT = 1;

    /// @dev Callback type for withdraw operations
    uint8 internal constant CALLBACK_WITHDRAW = 2;

    /*//////////////////////////////////////////////////////////////
                                 STRUCTS
    //////////////////////////////////////////////////////////////*/

    /// @dev Callback data for deposit/withdraw operations
    struct DepositCallbackData {
        uint8 callbackType;
        Currency currency;
        address sender;
        uint256 amount;
    }

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice The fixed price: token1 per token0, scaled by 1e18
    /// @dev Example: 1e18 means 1 token0 = 1 token1
    ///               2e18 means 1 token0 = 2 token1
    mapping(PoolId poolId => uint256 price) public prices;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Constructor
     * @param _poolManager The Uniswap V4 pool manager
     * @param _owner The owner of the contract
     */
    constructor(IPoolManager _poolManager, address _owner) BaseHook(_poolManager) Ownable(_owner) { }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update the fixed swap price
     * @param _newPrice The new price (token1 per token0, scaled by 1e18)
     */
    function setPrice(PoolId id, uint256 _newPrice) external virtual onlyOwner {
        if (_newPrice == 0) revert InvalidPrice();

        uint256 oldPrice = prices[id];
        prices[id] = _newPrice;

        emit PriceUpdated(id, oldPrice, _newPrice);
    }

    /*//////////////////////////////////////////////////////////////
                          DEPOSIT / WITHDRAW
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deposit tokens to the hook to provide liquidity for swaps
     * @dev The depositor must have approved the PoolManager to transfer tokens
     * @param currency The currency to deposit
     * @param amount The amount to deposit
     */
    function deposit(Currency currency, uint256 amount) external {
        poolManager.unlock(
            abi.encode(
                DepositCallbackData({
                    callbackType: CALLBACK_DEPOSIT, currency: currency, sender: msg.sender, amount: amount
                })
            )
        );
    }

    /**
     * @notice Withdraw tokens from the hook
     * @dev Only the owner can withdraw
     * @param currency The currency to withdraw
     * @param amount The amount to withdraw
     * @param recipient The address to receive the tokens
     */
    function withdraw(Currency currency, uint256 amount, address recipient) external onlyOwner {
        poolManager.unlock(
            abi.encode(
                DepositCallbackData({
                    callbackType: CALLBACK_WITHDRAW, currency: currency, sender: recipient, amount: amount
                })
            )
        );
    }

    /**
     * @dev Override unlockCallback to handle deposit/withdraw operations
     */
    function unlockCallback(bytes calldata rawData) public override onlyPoolManager returns (bytes memory) {
        // Try to decode as DepositCallbackData first
        // Check if this is a deposit/withdraw callback by checking the first byte pattern
        if (rawData.length >= 32) {
            // Try to decode as DepositCallbackData
            DepositCallbackData memory depositData = abi.decode(rawData, (DepositCallbackData));

            if (depositData.callbackType == CALLBACK_DEPOSIT) {
                // Settle tokens from depositor to pool
                depositData.currency.settle(poolManager, depositData.sender, depositData.amount, false);
                // Take claims for the hook
                depositData.currency.take(poolManager, address(this), depositData.amount, true);

                emit Deposited(depositData.currency, depositData.sender, depositData.amount);
                return "";
            } else if (depositData.callbackType == CALLBACK_WITHDRAW) {
                // Settle claims from hook to pool (burn claims)
                depositData.currency.settle(poolManager, address(this), depositData.amount, true);
                // Take tokens for the recipient
                depositData.currency.take(poolManager, depositData.sender, depositData.amount, false);

                emit Withdrawn(depositData.currency, depositData.sender, depositData.amount);
                return "";
            }
        }

        // If not a deposit/withdraw, delegate to parent implementation
        return super.unlockCallback(rawData);
    }

    /*//////////////////////////////////////////////////////////////
                           SWAP LOGIC (CORE)
    //////////////////////////////////////////////////////////////*/

    function _getUnspecifiedAmount(PoolKey memory key, SwapParams calldata params)
        internal
        view
        virtual
        override
        returns (uint256 unspecifiedAmount)
    {
        bool exactInput = params.amountSpecified < 0;
        uint256 specifiedAmount = exactInput ? uint256(-params.amountSpecified) : uint256(params.amountSpecified);

        uint256 price = prices[key.toId()];

        if (exactInput) {
            // User specified input amount, calculate output
            if (params.zeroForOne) {
                // Swapping token0 -> token1
                // output = input * price / 1e18
                unspecifiedAmount = (specifiedAmount * price) / 1e18;
            } else {
                // Swapping token1 -> token0
                // output = input * 1e18 / price
                unspecifiedAmount = (specifiedAmount * 1e18) / price;
            }
        } else {
            // User specified output amount, calculate input needed (round up to avoid under-delivery)
            if (params.zeroForOne) {
                // Swapping token0 -> token1, user wants specific token1 output
                // input = ceil(output * 1e18 / price)
                unspecifiedAmount = (specifiedAmount * 1e18 + price - 1) / price;
            } else {
                // Swapping token1 -> token0, user wants specific token0 output
                // input = ceil(output * price / 1e18)
                unspecifiedAmount = (specifiedAmount * price + 1e18 - 1) / 1e18;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get the current price quote for a swap exact output
     * @param amount Output amount
     * @param zeroForOne True if swapping token0 for token1
     */

    function getQuote(PoolId id, uint256 amount, bool zeroForOne, bool exactOutput)
        external
        view
        returns (uint256 result)
    {
        uint256 price = prices[id];
        if (exactOutput) {
            // amount = amountOut, result = amountIn (round up)
            if (zeroForOne) {
                result = (amount * 1e18 + price - 1) / price;
            } else {
                result = (amount * price + 1e18 - 1) / 1e18;
            }
        } else {
            // amount = amountIn, result = amountOut
            if (zeroForOne) {
                result = (amount * price) / 1e18;
            } else {
                result = (amount * 1e18) / price;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                    LIQUIDITY MANAGEMENT (NOT IMPLEMENTED)
    //////////////////////////////////////////////////////////////*/

    function _getAmountIn(AddLiquidityParams memory params)
        internal
        view
        override
        returns (uint256 amount0, uint256 amount1, uint256 liquidity)
    {
        revert NotImplemented();
    }

    function _getAmountOut(RemoveLiquidityParams memory params)
        internal
        view
        override
        returns (uint256 amount0, uint256 amount1, uint256 liquidity)
    {
        revert NotImplemented();
    }

    function _mint(AddLiquidityParams memory params, BalanceDelta callerDelta, BalanceDelta feesAccrued, uint256 shares)
        internal
        override
    {
        revert NotImplemented();
    }

    function _burn(
        RemoveLiquidityParams memory params,
        BalanceDelta callerDelta,
        BalanceDelta feesAccrued,
        uint256 shares
    ) internal override {
        revert NotImplemented();
    }

    function _getSwapFeeAmount(SwapParams calldata params, uint256 unspecifiedAmount)
        internal
        view
        override
        returns (uint256 swapFeeAmount)
    {
        return 0;
    }
}
