// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BaseFixedPriceHook } from "../base/BaseFixedPriceHook.sol";
import { IPoolManager } from "@v4-core/interfaces/IPoolManager.sol";
import { PoolKey } from "@v4-core/types/PoolKey.sol";
import { SwapParams, ModifyLiquidityParams } from "@v4-core/types/PoolOperation.sol";
import { PoolId } from "@v4-core/types/PoolId.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract FixedPriceLicenseHook is BaseFixedPriceHook {
    error RedeemNotAllowed();
    error ModifyingLiquidityNotAllowed();
    error DonatingNotAllowed();
    error PatentNotDelegated();
    error CampaignStopped();
    error CampaignNotInitialized();
    error CampaignAlreadyInitialized();

    IERC721 public immutable patentErc721;

    mapping(PoolId poolId => uint256 patentId) public patentIds;
    mapping(PoolId poolId => bool stopped) public isStopped;

    constructor(IPoolManager _poolManager, address _owner, IERC721 _patentErc721)
        BaseFixedPriceHook(_poolManager, _owner)
    {
        patentErc721 = _patentErc721;
    }

    // owner of contract always should be campaign manager
    modifier onlyInitializedCamapign(PoolId poolId) {
        uint256 patentId = patentIds[poolId];
        require(patentId != 0, CampaignNotInitialized());
        require(patentErc721.ownerOf(patentId) == owner(), PatentNotDelegated());
        _;
    }

    modifier onlyNotStopped(PoolId poolId) {
        require(!isStopped[poolId], CampaignStopped());
        _;
    }

    function setStopped(PoolId poolId, bool _stopped) external onlyOwner {
        isStopped[poolId] = _stopped;
    }

    function initializeCampaign(PoolId poolId, uint256 patentId) external onlyOwner {
        require(patentIds[poolId] == 0, CampaignAlreadyInitialized());
        require(patentErc721.ownerOf(patentId) == owner(), PatentNotDelegated());
        patentIds[poolId] = patentId;
    }

    function _getUnspecifiedAmount(PoolKey memory key, SwapParams calldata params)
        internal
        view
        override
        onlyInitializedCamapign(key.toId())
        onlyNotStopped(key.toId())
        returns (uint256 unspecifiedAmount)
    {
        return super._getUnspecifiedAmount(key, params);
    }

    function _beforeInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96)
        internal
        override
        onlyInitializedCamapign(key.toId())
        onlyNotStopped(key.toId())
        returns (bytes4)
    {
        return super._beforeInitialize(sender, key, sqrtPriceX96);
    }

    function _beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        internal
        pure
        override
        returns (bytes4)
    {
        revert ModifyingLiquidityNotAllowed();
    }

    function _beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        internal
        pure
        override
        returns (bytes4)
    {
        revert ModifyingLiquidityNotAllowed();
    }

    function _beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        internal
        pure
        override
        returns (bytes4)
    {
        revert DonatingNotAllowed();
    }
}
