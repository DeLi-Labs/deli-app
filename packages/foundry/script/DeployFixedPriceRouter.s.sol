// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./DeployHelpers.s.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {HookMiner} from "@v4-periphery/utils/HookMiner.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {FixedPriceLicenseHook} from "../contracts/fixed/FixedPriceLicenseHook.sol";
import {FixedPriceSwapRouter} from "../contracts/fixed/FixedPriceSwapRouter.sol";
import {CampaignManager} from "../contracts/fixed/CampaignManager.sol";
import {IPERC721} from "../contracts/IPERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAuthCaptureEscrow} from "../contracts/interfaces/IAuthCaptureEscrow.sol";

/// @dev Mock ERC20 for numeraire token
contract MockNumeraire is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @notice Deploy script for FixedPriceSwapRouter and all dependencies
 * @dev Deploys: MockNumeraire, IPERC721, FixedPriceLicenseHook, FixedPriceSwapRouter, CampaignManager
 *
 * Run with mainnet fork:
 *   forge script script/DeployFixedPriceRouter.s.sol --broadcast --rpc-url http://localhost:8545 --private-key <key>
 *
 * Start anvil with mainnet fork first:
 *   anvil --fork-url https://eth-mainnet.g.alchemy.com/v2/<API_KEY>
 */
contract DeployFixedPriceRouter is ScaffoldETHDeploy {

    // CREATE2 Deployer Proxy address used by forge script
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Canonical addresses (same on mainnet and most L2s)
    address constant POOL_MANAGER_ADDRESS = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    address constant PERMIT2_ADDRESS = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    IPoolManager public poolManager;
    IAllowanceTransfer public permit2;

    // Deployed contracts
    MockNumeraire public numeraire;
    IPERC721 public patentNFT;
    FixedPriceLicenseHook public hook;
    FixedPriceSwapRouter public router;
    CampaignManager public campaignManager;

    function run(address authCaptureEscrow, address tokenCollector) external ScaffoldEthDeployerRunner {
        console.log("Deploying FixedPriceSwapRouter system...");
        console.log("Deployer:", deployer);

        // Step 1: Deploy or get PoolManager
        _deployPoolManager();

        // Step 2: Deploy or get Permit2
        _deployPermit2();

        // Step 3: Deploy mock tokens (must be before hook since hook needs patentNFT)
        _deployMockTokens();

        // Step 4: Deploy hook at correct address (needs patentNFT)
        _deployHook();

        // Step 5: Deploy router
        _deployRouter();

        // Step 6: Deploy campaign manager
        _deployCampaignManager(authCaptureEscrow, tokenCollector, address(hook));

        // Log summary
        _logSummary();
    }

    function _deployPoolManager() internal {
        // Use canonical PoolManager address (available on mainnet fork)
        require(POOL_MANAGER_ADDRESS.code.length > 0, "PoolManager not found - ensure you're running on a mainnet fork");
        poolManager = IPoolManager(POOL_MANAGER_ADDRESS);
        console.log("Using PoolManager at:", address(poolManager));
    }

    function _deployPermit2() internal {
        // Use canonical Permit2 address (available on mainnet fork)
        require(PERMIT2_ADDRESS.code.length > 0, "Permit2 not found - ensure you're running on a mainnet fork");
        permit2 = IAllowanceTransfer(PERMIT2_ADDRESS);
        console.log("Using Permit2 at:", address(permit2));
    }

    function _deployMockTokens() internal {
        console.log("Deploying tokens...");

        // Deploy numeraire (mock USDC)
        numeraire = new MockNumeraire();
        console.log("MockNumeraire deployed at:", address(numeraire));
        deployments.push(Deployment("MockNumeraire", address(numeraire)));

        // Deploy patent NFT (real IPERC721)
        patentNFT = new IPERC721(deployer);
        console.log("IPERC721 deployed at:", address(patentNFT));
        deployments.push(Deployment("IPERC721", address(patentNFT)));
    }

    function _deployHook() internal {
        console.log("Deploying FixedPriceLicenseHook...");

        // Hook flags from BaseCustomCurve.getHookPermissions()
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
            Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG |
            Hooks.BEFORE_SWAP_FLAG |
            Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );

        // Find salt for hook address with correct flags
        bytes memory constructorArgs = abi.encode(address(poolManager), deployer, IERC721(address(patentNFT)));
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(FixedPriceLicenseHook).creationCode,
            constructorArgs
        );

        console.log("Found hook address:", hookAddress);
        console.log("Using salt:", vm.toString(salt));

        hook = new FixedPriceLicenseHook{salt: salt}(poolManager, deployer, IERC721(address(patentNFT)));
        require(address(hook) == hookAddress, "Hook address mismatch");

        console.log("FixedPriceLicenseHook deployed at:", address(hook));
        deployments.push(Deployment("FixedPriceLicenseHook", address(hook)));
    }

    function _deployRouter() internal {
        console.log("Deploying FixedPriceSwapRouter...");

        router = new FixedPriceSwapRouter(poolManager, permit2, hook);
        console.log("FixedPriceSwapRouter deployed at:", address(router));
        deployments.push(Deployment("FixedPriceSwapRouter", address(router)));
    }

    function _deployCampaignManager(address authCaptureEscrow, address tokenCollector, address hookAddress) internal {
        console.log("Deploying CampaignManager...");

        // Set up allowed numeraires (just our mock numeraire for now)
        IERC20[] memory allowedNumeraires = new IERC20[](1);
        allowedNumeraires[0] = IERC20(address(numeraire));

        campaignManager = new CampaignManager(
            deployer,
            poolManager,
            IERC721(address(patentNFT)),
            allowedNumeraires,
            hook,
            IAuthCaptureEscrow(authCaptureEscrow),
            tokenCollector,
            deployer
        );

        hook.transferOwnership(address(campaignManager));

        console.log("CampaignManager deployed at:", address(campaignManager));
        deployments.push(Deployment("CampaignManager", address(campaignManager)));
    }


    function _logSummary() internal view {
        console.log("");
        console.log("========== DEPLOYMENT SUMMARY ==========");
        console.log("PoolManager:           ", address(poolManager));
        console.log("Permit2:               ", address(permit2));
        console.log("MockNumeraire:         ", address(numeraire));
        console.log("IPERC721:              ", address(patentNFT));
        console.log("FixedPriceLicenseHook: ", address(hook));
        console.log("FixedPriceSwapRouter:  ", address(router));
        console.log("CampaignManager:       ", address(campaignManager));
        console.log("=========================================");
    }
}
