// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "@v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@v4-core/types/PoolKey.sol";
import {Currency} from "@v4-core/types/Currency.sol";
import {IHooks} from "@v4-core/interfaces/IHooks.sol";
import {FixedPriceLicenseHook} from "./FixedPriceLicenseHook.sol";
import {LicenseERC20} from "../LicenseERC20.sol";
import {TickMath} from "@v4-core/libraries/TickMath.sol";
import {LicenseType} from "../LicenseERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {PoolId} from "@v4-core/types/PoolId.sol";
import {IAuthCaptureEscrow} from "../interfaces/IAuthCaptureEscrow.sol";

/// @title CampaignManager
/// @notice Deploys campaigns with configuration; seeds pool.
contract CampaignManager is Ownable, IERC721Receiver {
    error InvalidAssetNumeraireOrder();
    error NumeraireNotAllowed();
    error PatentNotOwned();
    error InvalidOperator();
    error InvalidLicenseContract();
    error PatentNotStaked();
    error PatentAlreadyStaked();
    error NotStaker();
    error CampaignAlreadyInitialized();

    event CampaignInitialized(
        uint256 patentId,
        address license,
        address numeraire,
        PoolId poolId
    );

    event PatentStaked(uint256 patentId, address staker);
    event PatentRedeemed(uint256 patentId, address staker);

    int24 public constant TICK_SPACING = 30;
    uint48 public constant PRE_APPROVAL_EXPIRY = 1 days;
    uint48 public constant AUTHORIZATION_EXPIRY = 1 days;
    uint48 public constant REFUND_EXPIRY = 1 days;

    FixedPriceLicenseHook public immutable licenseHook;
    IPoolManager public immutable poolManager;
    IERC721 public immutable patentErc721;
    IAuthCaptureEscrow public immutable authCaptureEscrow;

    // TODO: implement proper treasury manager contract
    address public immutable treasuryManager;

    address public immutable permit2TokenCollector;

    uint256 public saltIndex = 0;

    mapping(IERC20 numeraire => bool) public allowedNumeraires;
    mapping(uint256 patentId => address staker) public stakedPatents;

    constructor(
        address _owner,
        IPoolManager _manager,
        IERC721 _patentErc721,
        IERC20[] memory _allowedNumeraires,
        FixedPriceLicenseHook _licenseHook,
        IAuthCaptureEscrow _authCaptureEscrow,
        address _permit2TokenCollector,
        address _treasuryManager
    ) Ownable(_owner) {
        patentErc721 = _patentErc721;
        poolManager = _manager;
        licenseHook = _licenseHook;
        authCaptureEscrow = _authCaptureEscrow;
        permit2TokenCollector = _permit2TokenCollector;
        treasuryManager = _treasuryManager;

        for (uint256 i = 0; i < _allowedNumeraires.length; i++) {
            allowedNumeraires[_allowedNumeraires[i]] = true;
        }
    }

    function initialize(
        uint256 patentId,
        string memory assetMetadataUri,
        bytes32 licenseSalt,
        IERC20 numeraire,
        LicenseType licenseType,
        uint256 price,
        uint256 totalTokensToSell
    ) external {
        _validateGeneral(
            assetMetadataUri,
            patentId,
            licenseSalt,
            numeraire,
            licenseType
        );

        LicenseERC20 license = new LicenseERC20{salt: licenseSalt}(
            patentErc721,
            patentId,
            assetMetadataUri,
            licenseType
        );

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(numeraire)),
            currency1: Currency.wrap(address(license)),
            hooks: IHooks(licenseHook),
            fee: 0,
            tickSpacing: TICK_SPACING
        });

        license.mint(address(this), totalTokensToSell);
        license.approve(address(licenseHook), totalTokensToSell);
        licenseHook.deposit(Currency.wrap(address(license)), totalTokensToSell);

        licenseHook.initializeCampaign(poolKey.toId(), patentId);

        poolManager.initialize(poolKey, TickMath.getSqrtPriceAtTick(0));

        licenseHook.setPrice(poolKey.toId(), price);

        emit CampaignInitialized(
            patentId,
            address(license),
            address(numeraire),
            poolKey.toId()
        );
    }

    // called by any user who want to settle licensed action
    function authorize(
        IAuthCaptureEscrow.PaymentInfo memory paymentInfo,
        bytes calldata collectorData
    ) external {
        LicenseERC20 license = LicenseERC20(paymentInfo.token);
        uint256 patentId = license.patentId();

        require(patentId != 0, InvalidLicenseContract());

        require(paymentInfo.operator == address(this), InvalidOperator());

        authCaptureEscrow.authorize(
            paymentInfo,
            paymentInfo.maxAmount,
            permit2TokenCollector,
            collectorData
        );
    }

    // can be called only by patent owner
    function capture(
        IAuthCaptureEscrow.PaymentInfo memory paymentInfo,
        uint256 amount
    ) external {
        LicenseERC20 license = LicenseERC20(paymentInfo.token);
        uint256 patentId = license.patentId();

        require(patentId != 0, InvalidLicenseContract());

        // Verify caller owns the patent
        require(patentErc721.ownerOf(patentId) == msg.sender, PatentNotOwned());

        // Verify operator matches
        require(paymentInfo.operator == address(this), InvalidOperator());

        authCaptureEscrow.capture(paymentInfo, amount, 0, address(0));
    }

    function validateAssetOrder(
        IERC20 numeraire,
        bytes32 salt,
        string memory assetMetadataUri,
        uint256 patentId,
        LicenseType licenseType,
        IERC721 patentRegistry,
        address deployer
    ) public pure {
        // Compute the address of the contract to be deployed and verify it's compatible with uni v4
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(LicenseERC20).creationCode,
                abi.encode(
                    patentRegistry,
                    patentId,
                    assetMetadataUri,
                    licenseType
                )
            )
        );
        address asset = Create2.computeAddress(salt, bytecodeHash, deployer);
        // Check that the asset address is bigger than the numeraire address (uni v4 requirement)
        require(asset > address(numeraire), InvalidAssetNumeraireOrder());
    }

    function _validateGeneral(
        string memory assetMetadataUri,
        uint256 patentId,
        bytes32 licenseSalt,
        IERC20 numeraire,
        LicenseType licenseType
    ) internal view {
        // Check that patent is staked
        require(stakedPatents[patentId] != address(0), PatentNotStaked());
        // Check that the patent is staked and the caller is the staker
        require(stakedPatents[patentId] == msg.sender, PatentNotOwned());
        // Verify that the patent is actually owned by this contract (staked)
        require(
            patentErc721.ownerOf(patentId) == address(this),
            PatentNotStaked()
        );
        validateAssetOrder(
            numeraire,
            licenseSalt,
            assetMetadataUri,
            patentId,
            licenseType,
            patentErc721,
            address(this)
        );
        // Check that the numeraire is allowed
        require(allowedNumeraires[numeraire], NumeraireNotAllowed());
    }

    /// @notice Handles receipt of ERC721 tokens. This function is called when a patent NFT is transferred to this contract.
    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata
    ) external override returns (bytes4) {
        // Only accept tokens from the patent ERC721 contract
        require(msg.sender == address(patentErc721), "Invalid token contract");

        // Check that patent is not already staked
        require(stakedPatents[tokenId] == address(0), PatentAlreadyStaked());

        // Record the staker
        stakedPatents[tokenId] = from;

        emit PatentStaked(tokenId, from);

        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Redeems (unstakes) a patent NFT. Only the original staker can redeem.
    /// @dev The hook will block operations if the patent owner is not the campaign manager.
    /// @param patentId The patent token ID to redeem
    function redeem(uint256 patentId) external {
        address staker = stakedPatents[patentId];
        require(staker != address(0), PatentNotStaked());
        require(staker == msg.sender, NotStaker());

        // Clear the staking record
        delete stakedPatents[patentId];

        // Transfer the patent back to the staker
        patentErc721.safeTransferFrom(address(this), staker, patentId);

        emit PatentRedeemed(patentId, staker);
    }
}
