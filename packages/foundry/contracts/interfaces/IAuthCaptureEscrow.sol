// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IAuthCaptureEscrow
/// @notice Interface for AuthCaptureEscrow contract to avoid Solidity version conflicts
interface IAuthCaptureEscrow {
    /// @notice Payment info, contains all information required to authorize and capture a unique payment
    struct PaymentInfo {
        /// @dev Entity responsible for driving payment flow
        address operator;
        /// @dev The payer's address authorizing the payment
        address payer;
        /// @dev Address that receives the payment (minus fees)
        address receiver;
        /// @dev The token contract address
        address token;
        /// @dev The amount of tokens that can be authorized
        uint120 maxAmount;
        /// @dev Timestamp when the payer's pre-approval can no longer authorize payment
        uint48 preApprovalExpiry;
        /// @dev Timestamp when an authorization can no longer be captured and the payer can reclaim from escrow
        uint48 authorizationExpiry;
        /// @dev Timestamp when a successful payment can no longer be refunded
        uint48 refundExpiry;
        /// @dev Minimum fee percentage in basis points
        uint16 minFeeBps;
        /// @dev Maximum fee percentage in basis points
        uint16 maxFeeBps;
        /// @dev Address that receives the fee portion of payments, if 0 then operator can set at capture
        address feeReceiver;
        /// @dev A source of entropy to ensure unique hashes across different payments
        uint256 salt;
    }

    /// @notice Transfers funds from payer to escrow
    /// @param paymentInfo PaymentInfo struct
    /// @param amount Amount to authorize
    /// @param tokenCollector Address of the token collector
    /// @param collectorData Data to pass to the token collector
    function authorize(
        PaymentInfo calldata paymentInfo,
        uint256 amount,
        address tokenCollector,
        bytes calldata collectorData
    ) external;

    /// @notice Transfer previously-escrowed funds to receiver
    /// @param paymentInfo PaymentInfo struct
    /// @param amount Amount to capture
    /// @param feeBps Fee percentage to apply (must be within min/max range)
    /// @param feeReceiver Address to receive fees
    function capture(
        PaymentInfo calldata paymentInfo,
        uint256 amount,
        uint16 feeBps,
        address feeReceiver
    ) external;
}
