// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./DeployHelpers.s.sol";

// Note: We use vm.deployCode() to deploy from artifacts instead of importing source files
// This allows this script to use Solidity 0.8.28 while avoiding conflicts with other contracts

/**
 * @notice Deploy script for AuthCaptureEscrow and token collectors
 * @dev Deploys: AuthCaptureEscrow, ERC3009PaymentCollector, PreApprovalPaymentCollector, Permit2PaymentCollector, OperatorRefundCollector
 * @dev Uses vm.deployCode() to deploy from artifacts, avoiding Solidity version conflicts
 *
 * Run with mainnet fork:
 *   forge script script/DeployAuthCaptureEscrow.s.sol --broadcast --rpc-url http://localhost:8545 --private-key <key>
 *
 * Start anvil with mainnet fork first:
 *   anvil --fork-url https://eth-mainnet.g.alchemy.com/v2/<API_KEY>
 */
contract DeployAuthCaptureEscrow is ScaffoldETHDeploy {
    // Known addresses (same on mainnet and most L2s)
    address constant MULTICALL3 = 0xcA11bde05977b3631167028862bE2a173976CA11;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // Deployed contracts (addresses from artifacts)
    address public authCaptureEscrow;
    address public erc3009PaymentCollector;
    address public preApprovalPaymentCollector;
    address public permit2PaymentCollector;
    address public operatorRefundCollector;

    function run() external ScaffoldEthDeployerRunner {
        console.log("Deploying AuthCaptureEscrow system from artifacts...");
        console.log("Deployer:", deployer);

        // Step 1: Deploy AuthCaptureEscrow
        _deployAuthCaptureEscrow();

        // Step 2: Deploy token collectors
        _deployTokenCollectors();

        // Log summary
        _logSummary();
    }

    function _deployAuthCaptureEscrow() internal {
        console.log("Deploying AuthCaptureEscrow from artifact...");

        // AuthCaptureEscrow constructor takes no arguments
        // Use full path to artifact JSON file
        authCaptureEscrow = vm.deployCode("lib/commerce-payments/out/AuthCaptureEscrow.sol/AuthCaptureEscrow.json");
        console.log("AuthCaptureEscrow deployed at:", authCaptureEscrow);
        deployments.push(Deployment("AuthCaptureEscrow", authCaptureEscrow));
    }

    function _deployTokenCollectors() internal {
        console.log("Deploying token collectors from artifacts...");

        // Deploy ERC3009PaymentCollector
        bytes memory erc3009Args = abi.encode(authCaptureEscrow, MULTICALL3);
        erc3009PaymentCollector = vm.deployCode(
            "lib/commerce-payments/out/ERC3009PaymentCollector.sol/ERC3009PaymentCollector.json", erc3009Args
        );
        console.log("ERC3009PaymentCollector deployed at:", erc3009PaymentCollector);
        deployments.push(Deployment("ERC3009PaymentCollector", erc3009PaymentCollector));

        // Deploy PreApprovalPaymentCollector
        bytes memory preApprovalArgs = abi.encode(authCaptureEscrow);
        preApprovalPaymentCollector = vm.deployCode(
            "lib/commerce-payments/out/PreApprovalPaymentCollector.sol/PreApprovalPaymentCollector.json",
            preApprovalArgs
        );
        console.log("PreApprovalPaymentCollector deployed at:", preApprovalPaymentCollector);
        deployments.push(Deployment("PreApprovalPaymentCollector", preApprovalPaymentCollector));

        // Deploy Permit2PaymentCollector
        bytes memory permit2Args = abi.encode(authCaptureEscrow, PERMIT2, MULTICALL3);
        permit2PaymentCollector = vm.deployCode(
            "lib/commerce-payments/out/Permit2PaymentCollector.sol/Permit2PaymentCollector.json", permit2Args
        );
        console.log("Permit2PaymentCollector deployed at:", permit2PaymentCollector);
        deployments.push(Deployment("Permit2PaymentCollector", permit2PaymentCollector));

        // Deploy OperatorRefundCollector
        bytes memory refundArgs = abi.encode(authCaptureEscrow);
        operatorRefundCollector = vm.deployCode(
            "lib/commerce-payments/out/OperatorRefundCollector.sol/OperatorRefundCollector.json", refundArgs
        );
        console.log("OperatorRefundCollector deployed at:", operatorRefundCollector);
        deployments.push(Deployment("OperatorRefundCollector", operatorRefundCollector));
    }

    function _logSummary() internal view {
        console.log("");
        console.log("========== DEPLOYMENT SUMMARY ==========");
        console.log("AuthCaptureEscrow:           ", authCaptureEscrow);
        console.log("ERC3009PaymentCollector:     ", erc3009PaymentCollector);
        console.log("PreApprovalPaymentCollector: ", preApprovalPaymentCollector);
        console.log("Permit2PaymentCollector:     ", permit2PaymentCollector);
        console.log("OperatorRefundCollector:     ", operatorRefundCollector);
        console.log("");
        console.log("Known addresses used:");
        console.log("Multicall3:                  ", MULTICALL3);
        console.log("Permit2:                     ", PERMIT2);
        console.log("=========================================");
    }
}
