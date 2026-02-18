//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "./DeployFixedPriceRouter.s.sol";
import "./DeployAuthCaptureEscrow.s.sol";

/**
 * @notice Main deployment script for all contracts
 * @dev Run this when you want to deploy multiple contracts at once
 *
 * Example: yarn deploy # runs this script(without`--file` flag)
 *
 * Note: DeployAuthCaptureEscrow uses Solidity 0.8.28 and deploys from artifacts using vm.deployCode()
 * to avoid version conflicts with V4Router's 0.8.26 requirement.
 */
contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        // Deploys all your contracts sequentially
        // Add new deployments here when needed

        DeployAuthCaptureEscrow deployAuthCaptureEscrow = new DeployAuthCaptureEscrow();
        deployAuthCaptureEscrow.run();

        address authCaptureEscrow = deployAuthCaptureEscrow.authCaptureEscrow();
        address tokenCollector = deployAuthCaptureEscrow.permit2PaymentCollector();

        DeployFixedPriceRouter deployFixedPriceRouter = new DeployFixedPriceRouter();
        deployFixedPriceRouter.run(authCaptureEscrow, tokenCollector);

        // Deploy another contract
        // DeployMyContract myContract = new DeployMyContract();
        // myContract.run();
    }
}
