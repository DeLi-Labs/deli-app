// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IAuthCaptureEscrow } from "./IAuthCaptureEscrow.sol";

/// @title IPreApprovalPaymentCollector
/// @notice Interface for PreApprovalPaymentCollector contract to avoid Solidity version conflicts
interface IPreApprovalPaymentCollector {
    /// @notice Registers buyer's token approval for a specific payment
    /// @param paymentInfo PaymentInfo struct
    function preApprove(IAuthCaptureEscrow.PaymentInfo calldata paymentInfo) external;
}
