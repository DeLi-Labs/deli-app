// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";

import {FixedPriceLicenseHook} from "../contracts/fixed/FixedPriceLicenseHook.sol";
import {FixedPriceSwapRouter} from "../contracts/fixed/FixedPriceSwapRouter.sol";
import {LicenseERC20, LicenseType} from "../contracts/LicenseERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @dev Mock ERC20 for numeraire
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Mock ERC721 for patents
contract MockPatentNFT is IERC721 {
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;

    function mint(address to, uint256 tokenId) external {
        require(_owners[tokenId] == address(0), "Token already minted");
        _owners[tokenId] = to;
        _balances[to]++;
    }

    function ownerOf(uint256 tokenId) external view override returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }

    function balanceOf(address owner) external view override returns (uint256) {
        require(owner != address(0), "Balance query for zero address");
        return _balances[owner];
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external override {
        _transfer(from, to, tokenId);
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                require(retval == IERC721Receiver.onERC721Received.selector, "Transfer to non ERC721Receiver");
            } catch (bytes memory) {
                revert("Transfer to non ERC721Receiver");
            }
        }
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external override {
        _transfer(from, to, tokenId);
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, "") returns (bytes4 retval) {
                require(retval == IERC721Receiver.onERC721Received.selector, "Transfer to non ERC721Receiver");
            } catch (bytes memory) {
                revert("Transfer to non ERC721Receiver");
            }
        }
    }

    function transferFrom(address from, address to, uint256 tokenId) external override {
        _transfer(from, to, tokenId);
    }

    function approve(address, uint256) external pure override {
        // Approval not needed for tests
    }

    function setApprovalForAll(address, bool) external pure override {
        // Approval not needed for tests
    }

    function getApproved(uint256) external pure override returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure override returns (bool) {
        return true; // Allow all transfers for simplicity in tests
    }

    function supportsInterface(bytes4) external pure override returns (bool) {
        return true;
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        require(_owners[tokenId] == from, "Transfer from incorrect owner");
        require(to != address(0), "Transfer to zero address");
        
        _owners[tokenId] = to;
        _balances[from]--;
        _balances[to]++;
    }
}

contract FixedPriceSwapRouterTest is Test, Deployers, DeployPermit2 {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    IPoolManager constant POOL_MANAGER = IPoolManager(address(0x000000000004444c5dc75cB358380D2e3dE08A90));

    FixedPriceLicenseHook hook;
    FixedPriceSwapRouter router;
    IAllowanceTransfer permit2;

    MockERC20 numeraire;
    MockPatentNFT patentNFT;
    LicenseERC20 licenseToken;

    PoolKey poolKey;
    PoolId poolId;

    address alice = makeAddr("alice");
    uint256 constant PATENT_ID = 1;
    // Price in hook terms: price = 1 means 1 numeraire (18 decimals) buys 1e-18 license (0 decimals)
    // For exact output: input = output * 1e18 / price
    // With price = 1: input = 5 * 1e18 / 1 = 5e18 (5 numeraire per 1 license)
    uint256 constant LICENSE_PRICE = 1;
    uint256 constant TOTAL_LICENSES = 1000;

    function setUp() public {
        // Deploy PoolManager
        deployCodeTo("PoolManager", abi.encode(address(this)), address(POOL_MANAGER));
        manager = POOL_MANAGER;

        // Deploy Permit2
        permit2 = IAllowanceTransfer(deployPermit2());

        // Deploy mock tokens
        numeraire = new MockERC20("USDC", "USDC");
        patentNFT = new MockPatentNFT();

        // Mint patent to this contract (so we can create license)
        patentNFT.mint(address(this), PATENT_ID);

        // Deploy hook at the correct address (with hook flags)
        // Hook flags from BaseCustomCurve.getHookPermissions():
        // beforeInitialize: true, beforeAddLiquidity: true, beforeRemoveLiquidity: true,
        // beforeSwap: true, beforeSwapReturnDelta: true
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
            Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG |
            Hooks.BEFORE_SWAP_FLAG |
            Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );

        // Deploy hook at the correct address using deployCodeTo
        address hookAddress = address(flags);
        deployCodeTo(
            "contracts/fixed/FixedPriceLicenseHook.sol:FixedPriceLicenseHook",
            abi.encode(address(manager), address(this), IERC721(address(patentNFT))),
            hookAddress
        );
        hook = FixedPriceLicenseHook(hookAddress);
        
        // Initialize hook with a mock campaignManager address (use test contract as campaignManager for testing)
        // In production, this would be the actual CampaignManager address
        hook.initializeCampaign(poolId, PATENT_ID);

        // Deploy license token - we need to ensure address(numeraire) < address(licenseToken)
        // Use create2 or deploy multiple times until we get the right order
        bytes32 salt = bytes32(uint256(0));
        while (true) {
            address predicted = vm.computeCreate2Address(
                salt,
                keccak256(abi.encodePacked(
                    type(LicenseERC20).creationCode,
                    abi.encode(
                        IERC721(address(patentNFT)),
                        PATENT_ID,
                        "ipfs://license-metadata",
                        LicenseType.SingleUse
                    )
                )),
                address(this)
            );
            if (address(numeraire) < predicted) {
                licenseToken = new LicenseERC20{salt: salt}(
                    IERC721(address(patentNFT)),
                    PATENT_ID,
                    "ipfs://license-metadata",
                    LicenseType.SingleUse
                );
                break;
            }
            salt = bytes32(uint256(salt) + 1);
        }

        // Create pool key
        poolKey = PoolKey({
            currency0: Currency.wrap(address(numeraire)),
            currency1: Currency.wrap(address(licenseToken)),
            hooks: IHooks(address(hook)),
            fee: 0,
            tickSpacing: 30
        });
        poolId = poolKey.toId();

        // Initialize campaign in hook (required before pool initialization)
        // Since we're the owner and this is a test, we can call initializeCampaign directly
        hook.initializeCampaign(poolId, PATENT_ID);

        // Initialize pool
        manager.initialize(poolKey, TickMath.getSqrtPriceAtTick(0));

        // Set price in the hook
        hook.setPrice(poolId, LICENSE_PRICE);

        // Mint license tokens to this contract first
        licenseToken.mint(address(this), TOTAL_LICENSES);

        // Approve the hook to transfer license tokens (settle uses transferFrom from hook)
        licenseToken.approve(address(hook), type(uint256).max);

        // Deposit license tokens to the hook (gives hook claims in PoolManager)
        hook.deposit(Currency.wrap(address(licenseToken)), TOTAL_LICENSES);

        // Deploy router
        router = new FixedPriceSwapRouter(manager, permit2, hook);

        // Setup alice with numeraire
        numeraire.mint(alice, 10000e18);

        // Alice approves permit2
        vm.startPrank(alice);
        numeraire.approve(address(permit2), type(uint256).max);
        // Alice approves router on permit2
        permit2.approve(address(numeraire), address(router), type(uint160).max, type(uint48).max);
        vm.stopPrank();
    }

    function test_swapExactOutputSingle_buyLicenses() public {
        uint128 amountOut = 5; // Buy 5 licenses
        uint128 amountInMaximum = 1000e18; // Willing to pay up to 1000 numeraire

        uint256 aliceNumeraireBefore = numeraire.balanceOf(alice);
        uint256 aliceLicensesBefore = licenseToken.balanceOf(alice);

        vm.prank(alice);
        router.swapExactOutputSingle(poolKey, amountOut, amountInMaximum, true, "");

        uint256 aliceNumeraireAfter = numeraire.balanceOf(alice);
        uint256 aliceLicensesAfter = licenseToken.balanceOf(alice);

        // Alice should have 5 more licenses
        assertEq(aliceLicensesAfter - aliceLicensesBefore, amountOut, "Should receive exact licenses");

        // Alice should have paid: input = output * 1e18 / price = 5 * 1e18 / 1 = 5e18 (5 numeraire)
        uint256 expectedCost = uint256(amountOut) * 1e18 / LICENSE_PRICE;
        assertEq(aliceNumeraireBefore - aliceNumeraireAfter, expectedCost, "Should pay correct amount");

        console.log("Licenses bought:", amountOut);
        console.log("Numeraire paid:", aliceNumeraireBefore - aliceNumeraireAfter);
    }

    function test_swapExactOutputSingle_revertsOnWrongHook() public {
        // Create a pool key with wrong hook
        PoolKey memory wrongPoolKey = PoolKey({
            currency0: poolKey.currency0,
            currency1: poolKey.currency1,
            hooks: IHooks(address(0x1234)), // Wrong hook
            fee: 0,
            tickSpacing: 30
        });

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(
            FixedPriceSwapRouter.PoolHookMismatch.selector,
            address(hook),
            address(0x1234)
        ));
        router.swapExactOutputSingle(wrongPoolKey, 1, 1000e18, true, "");
    }

    function test_swapExactOutputSingle_revertsOnExcessiveSlippage() public {
        uint128 amountOut = 10; // Buy 10 licenses
        // Actual cost = amountOut * 1e18 / LICENSE_PRICE
        // Set max to half the required amount - should always fail
        uint128 amountInMaximum = uint128(uint256(amountOut) * 1e18 / LICENSE_PRICE / 2);

        vm.prank(alice);
        vm.expectRevert(); // Should revert due to slippage
        router.swapExactOutputSingle(poolKey, amountOut, amountInMaximum, true, "");
    }

    function test_swapExactOutputSingle_multipleSwaps() public {
        // First swap
        vm.prank(alice);
        router.swapExactOutputSingle(poolKey, 3, 1000e18, true, "");

        // Second swap
        vm.prank(alice);
        router.swapExactOutputSingle(poolKey, 2, 1000e18, true, "");

        // Alice should have 5 licenses total
        assertEq(licenseToken.balanceOf(alice), 5, "Should have 5 licenses");
    }
}
