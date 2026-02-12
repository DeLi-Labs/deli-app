import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * @example
 * const externalContracts = {
 *   1: {
 *     DAI: {
 *       address: "0x...",
 *       abi: [...],
 *     },
 *   },
 * } as const;
 */
const externalContracts = {
  31337: {
    LicenseERC20: {
      address: "0x0000000000000000000000000000000000000000",
      abi: [
        {
          type: "constructor",
          inputs: [
            {
              name: "_patentErc721",
              type: "address",
              internalType: "contract IERC721",
            },
            {
              name: "_patentId",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "_licenceMetadataUri",
              type: "string",
              internalType: "string",
            },
            {
              name: "_licenseType",
              type: "uint8",
              internalType: "enum LicenseType",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "allowance",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "approve",
          inputs: [
            {
              name: "spender",
              type: "address",
              internalType: "address",
            },
            {
              name: "value",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bool",
              internalType: "bool",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "balanceOf",
          inputs: [
            {
              name: "account",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "decimals",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "uint8",
              internalType: "uint8",
            },
          ],
          stateMutability: "pure",
        },
        {
          type: "function",
          name: "licenceMetadataUri",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "string",
              internalType: "string",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "mint",
          inputs: [
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "name",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "string",
              internalType: "string",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "patentErc721",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "contract IERC721",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "patentId",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "symbol",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "string",
              internalType: "string",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "totalSupply",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "transfer",
          inputs: [
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "value",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bool",
              internalType: "bool",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "transferFrom",
          inputs: [
            {
              name: "from",
              type: "address",
              internalType: "address",
            },
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "value",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bool",
              internalType: "bool",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "event",
          name: "Approval",
          inputs: [
            {
              name: "owner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "value",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "Transfer",
          inputs: [
            {
              name: "from",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "to",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "value",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "error",
          name: "ERC20InsufficientAllowance",
          inputs: [
            {
              name: "spender",
              type: "address",
              internalType: "address",
            },
            {
              name: "allowance",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "needed",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "ERC20InsufficientBalance",
          inputs: [
            {
              name: "sender",
              type: "address",
              internalType: "address",
            },
            {
              name: "balance",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "needed",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "ERC20InvalidApprover",
          inputs: [
            {
              name: "approver",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ERC20InvalidReceiver",
          inputs: [
            {
              name: "receiver",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ERC20InvalidSender",
          inputs: [
            {
              name: "sender",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "ERC20InvalidSpender",
          inputs: [
            {
              name: "spender",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "OnlyPatentOwner",
          inputs: [],
        },
      ],
    },
    IPoolManager: {
      address: "0x000000000004444c5dc75cB358380D2e3dE08A90",
      abi: [
        {
          type: "function",
          name: "allowance",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              internalType: "address",
            },
            {
              name: "id",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "approve",
          inputs: [
            {
              name: "spender",
              type: "address",
              internalType: "address",
            },
            {
              name: "id",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bool",
              internalType: "bool",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "balanceOf",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "id",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "burn",
          inputs: [
            {
              name: "from",
              type: "address",
              internalType: "address",
            },
            {
              name: "id",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "clear",
          inputs: [
            {
              name: "currency",
              type: "address",
              internalType: "Currency",
            },
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "collectProtocolFees",
          inputs: [
            {
              name: "recipient",
              type: "address",
              internalType: "address",
            },
            {
              name: "currency",
              type: "address",
              internalType: "Currency",
            },
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "amountCollected",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "donate",
          inputs: [
            {
              name: "key",
              type: "tuple",
              internalType: "struct PoolKey",
              components: [
                {
                  name: "currency0",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "currency1",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "fee",
                  type: "uint24",
                  internalType: "uint24",
                },
                {
                  name: "tickSpacing",
                  type: "int24",
                  internalType: "int24",
                },
                {
                  name: "hooks",
                  type: "address",
                  internalType: "contract IHooks",
                },
              ],
            },
            {
              name: "amount0",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "amount1",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "hookData",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          outputs: [
            {
              name: "",
              type: "int256",
              internalType: "BalanceDelta",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "extsload",
          inputs: [
            {
              name: "slot",
              type: "bytes32",
              internalType: "bytes32",
            },
          ],
          outputs: [
            {
              name: "value",
              type: "bytes32",
              internalType: "bytes32",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "extsload",
          inputs: [
            {
              name: "startSlot",
              type: "bytes32",
              internalType: "bytes32",
            },
            {
              name: "nSlots",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "values",
              type: "bytes32[]",
              internalType: "bytes32[]",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "extsload",
          inputs: [
            {
              name: "slots",
              type: "bytes32[]",
              internalType: "bytes32[]",
            },
          ],
          outputs: [
            {
              name: "values",
              type: "bytes32[]",
              internalType: "bytes32[]",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "exttload",
          inputs: [
            {
              name: "slots",
              type: "bytes32[]",
              internalType: "bytes32[]",
            },
          ],
          outputs: [
            {
              name: "values",
              type: "bytes32[]",
              internalType: "bytes32[]",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "exttload",
          inputs: [
            {
              name: "slot",
              type: "bytes32",
              internalType: "bytes32",
            },
          ],
          outputs: [
            {
              name: "value",
              type: "bytes32",
              internalType: "bytes32",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "initialize",
          inputs: [
            {
              name: "key",
              type: "tuple",
              internalType: "struct PoolKey",
              components: [
                {
                  name: "currency0",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "currency1",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "fee",
                  type: "uint24",
                  internalType: "uint24",
                },
                {
                  name: "tickSpacing",
                  type: "int24",
                  internalType: "int24",
                },
                {
                  name: "hooks",
                  type: "address",
                  internalType: "contract IHooks",
                },
              ],
            },
            {
              name: "sqrtPriceX96",
              type: "uint160",
              internalType: "uint160",
            },
          ],
          outputs: [
            {
              name: "tick",
              type: "int24",
              internalType: "int24",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "isOperator",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [
            {
              name: "approved",
              type: "bool",
              internalType: "bool",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "mint",
          inputs: [
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "id",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "modifyLiquidity",
          inputs: [
            {
              name: "key",
              type: "tuple",
              internalType: "struct PoolKey",
              components: [
                {
                  name: "currency0",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "currency1",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "fee",
                  type: "uint24",
                  internalType: "uint24",
                },
                {
                  name: "tickSpacing",
                  type: "int24",
                  internalType: "int24",
                },
                {
                  name: "hooks",
                  type: "address",
                  internalType: "contract IHooks",
                },
              ],
            },
            {
              name: "params",
              type: "tuple",
              internalType: "struct ModifyLiquidityParams",
              components: [
                {
                  name: "tickLower",
                  type: "int24",
                  internalType: "int24",
                },
                {
                  name: "tickUpper",
                  type: "int24",
                  internalType: "int24",
                },
                {
                  name: "liquidityDelta",
                  type: "int256",
                  internalType: "int256",
                },
                {
                  name: "salt",
                  type: "bytes32",
                  internalType: "bytes32",
                },
              ],
            },
            {
              name: "hookData",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          outputs: [
            {
              name: "callerDelta",
              type: "int256",
              internalType: "BalanceDelta",
            },
            {
              name: "feesAccrued",
              type: "int256",
              internalType: "BalanceDelta",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "protocolFeeController",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "protocolFeesAccrued",
          inputs: [
            {
              name: "currency",
              type: "address",
              internalType: "Currency",
            },
          ],
          outputs: [
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "setOperator",
          inputs: [
            {
              name: "operator",
              type: "address",
              internalType: "address",
            },
            {
              name: "approved",
              type: "bool",
              internalType: "bool",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bool",
              internalType: "bool",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "setProtocolFee",
          inputs: [
            {
              name: "key",
              type: "tuple",
              internalType: "struct PoolKey",
              components: [
                {
                  name: "currency0",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "currency1",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "fee",
                  type: "uint24",
                  internalType: "uint24",
                },
                {
                  name: "tickSpacing",
                  type: "int24",
                  internalType: "int24",
                },
                {
                  name: "hooks",
                  type: "address",
                  internalType: "contract IHooks",
                },
              ],
            },
            {
              name: "newProtocolFee",
              type: "uint24",
              internalType: "uint24",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "setProtocolFeeController",
          inputs: [
            {
              name: "controller",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "settle",
          inputs: [],
          outputs: [
            {
              name: "paid",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "payable",
        },
        {
          type: "function",
          name: "settleFor",
          inputs: [
            {
              name: "recipient",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [
            {
              name: "paid",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "payable",
        },
        {
          type: "function",
          name: "swap",
          inputs: [
            {
              name: "key",
              type: "tuple",
              internalType: "struct PoolKey",
              components: [
                {
                  name: "currency0",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "currency1",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "fee",
                  type: "uint24",
                  internalType: "uint24",
                },
                {
                  name: "tickSpacing",
                  type: "int24",
                  internalType: "int24",
                },
                {
                  name: "hooks",
                  type: "address",
                  internalType: "contract IHooks",
                },
              ],
            },
            {
              name: "params",
              type: "tuple",
              internalType: "struct SwapParams",
              components: [
                {
                  name: "zeroForOne",
                  type: "bool",
                  internalType: "bool",
                },
                {
                  name: "amountSpecified",
                  type: "int256",
                  internalType: "int256",
                },
                {
                  name: "sqrtPriceLimitX96",
                  type: "uint160",
                  internalType: "uint160",
                },
              ],
            },
            {
              name: "hookData",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          outputs: [
            {
              name: "swapDelta",
              type: "int256",
              internalType: "BalanceDelta",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "sync",
          inputs: [
            {
              name: "currency",
              type: "address",
              internalType: "Currency",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "take",
          inputs: [
            {
              name: "currency",
              type: "address",
              internalType: "Currency",
            },
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "transfer",
          inputs: [
            {
              name: "receiver",
              type: "address",
              internalType: "address",
            },
            {
              name: "id",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bool",
              internalType: "bool",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "transferFrom",
          inputs: [
            {
              name: "sender",
              type: "address",
              internalType: "address",
            },
            {
              name: "receiver",
              type: "address",
              internalType: "address",
            },
            {
              name: "id",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bool",
              internalType: "bool",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "unlock",
          inputs: [
            {
              name: "data",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          outputs: [
            {
              name: "",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "updateDynamicLPFee",
          inputs: [
            {
              name: "key",
              type: "tuple",
              internalType: "struct PoolKey",
              components: [
                {
                  name: "currency0",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "currency1",
                  type: "address",
                  internalType: "Currency",
                },
                {
                  name: "fee",
                  type: "uint24",
                  internalType: "uint24",
                },
                {
                  name: "tickSpacing",
                  type: "int24",
                  internalType: "int24",
                },
                {
                  name: "hooks",
                  type: "address",
                  internalType: "contract IHooks",
                },
              ],
            },
            {
              name: "newDynamicLPFee",
              type: "uint24",
              internalType: "uint24",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "event",
          name: "Approval",
          inputs: [
            {
              name: "owner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "id",
              type: "uint256",
              indexed: true,
              internalType: "uint256",
            },
            {
              name: "amount",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "Donate",
          inputs: [
            {
              name: "id",
              type: "bytes32",
              indexed: true,
              internalType: "PoolId",
            },
            {
              name: "sender",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "amount0",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
            {
              name: "amount1",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "Initialize",
          inputs: [
            {
              name: "id",
              type: "bytes32",
              indexed: true,
              internalType: "PoolId",
            },
            {
              name: "currency0",
              type: "address",
              indexed: true,
              internalType: "Currency",
            },
            {
              name: "currency1",
              type: "address",
              indexed: true,
              internalType: "Currency",
            },
            {
              name: "fee",
              type: "uint24",
              indexed: false,
              internalType: "uint24",
            },
            {
              name: "tickSpacing",
              type: "int24",
              indexed: false,
              internalType: "int24",
            },
            {
              name: "hooks",
              type: "address",
              indexed: false,
              internalType: "contract IHooks",
            },
            {
              name: "sqrtPriceX96",
              type: "uint160",
              indexed: false,
              internalType: "uint160",
            },
            {
              name: "tick",
              type: "int24",
              indexed: false,
              internalType: "int24",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "ModifyLiquidity",
          inputs: [
            {
              name: "id",
              type: "bytes32",
              indexed: true,
              internalType: "PoolId",
            },
            {
              name: "sender",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "tickLower",
              type: "int24",
              indexed: false,
              internalType: "int24",
            },
            {
              name: "tickUpper",
              type: "int24",
              indexed: false,
              internalType: "int24",
            },
            {
              name: "liquidityDelta",
              type: "int256",
              indexed: false,
              internalType: "int256",
            },
            {
              name: "salt",
              type: "bytes32",
              indexed: false,
              internalType: "bytes32",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "OperatorSet",
          inputs: [
            {
              name: "owner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "operator",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "approved",
              type: "bool",
              indexed: false,
              internalType: "bool",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "ProtocolFeeControllerUpdated",
          inputs: [
            {
              name: "protocolFeeController",
              type: "address",
              indexed: true,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "ProtocolFeeUpdated",
          inputs: [
            {
              name: "id",
              type: "bytes32",
              indexed: true,
              internalType: "PoolId",
            },
            {
              name: "protocolFee",
              type: "uint24",
              indexed: false,
              internalType: "uint24",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "Swap",
          inputs: [
            {
              name: "id",
              type: "bytes32",
              indexed: true,
              internalType: "PoolId",
            },
            {
              name: "sender",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "amount0",
              type: "int128",
              indexed: false,
              internalType: "int128",
            },
            {
              name: "amount1",
              type: "int128",
              indexed: false,
              internalType: "int128",
            },
            {
              name: "sqrtPriceX96",
              type: "uint160",
              indexed: false,
              internalType: "uint160",
            },
            {
              name: "liquidity",
              type: "uint128",
              indexed: false,
              internalType: "uint128",
            },
            {
              name: "tick",
              type: "int24",
              indexed: false,
              internalType: "int24",
            },
            {
              name: "fee",
              type: "uint24",
              indexed: false,
              internalType: "uint24",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "Transfer",
          inputs: [
            {
              name: "caller",
              type: "address",
              indexed: false,
              internalType: "address",
            },
            {
              name: "from",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "to",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "id",
              type: "uint256",
              indexed: true,
              internalType: "uint256",
            },
            {
              name: "amount",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "error",
          name: "AlreadyUnlocked",
          inputs: [],
        },
        {
          type: "error",
          name: "CurrenciesOutOfOrderOrEqual",
          inputs: [
            {
              name: "currency0",
              type: "address",
              internalType: "address",
            },
            {
              name: "currency1",
              type: "address",
              internalType: "address",
            },
          ],
        },
        {
          type: "error",
          name: "CurrencyNotSettled",
          inputs: [],
        },
        {
          type: "error",
          name: "InvalidCaller",
          inputs: [],
        },
        {
          type: "error",
          name: "ManagerLocked",
          inputs: [],
        },
        {
          type: "error",
          name: "MustClearExactPositiveDelta",
          inputs: [],
        },
        {
          type: "error",
          name: "NonzeroNativeValue",
          inputs: [],
        },
        {
          type: "error",
          name: "PoolNotInitialized",
          inputs: [],
        },
        {
          type: "error",
          name: "ProtocolFeeCurrencySynced",
          inputs: [],
        },
        {
          type: "error",
          name: "ProtocolFeeTooLarge",
          inputs: [
            {
              name: "fee",
              type: "uint24",
              internalType: "uint24",
            },
          ],
        },
        {
          type: "error",
          name: "SwapAmountCannotBeZero",
          inputs: [],
        },
        {
          type: "error",
          name: "TickSpacingTooLarge",
          inputs: [
            {
              name: "tickSpacing",
              type: "int24",
              internalType: "int24",
            },
          ],
        },
        {
          type: "error",
          name: "TickSpacingTooSmall",
          inputs: [
            {
              name: "tickSpacing",
              type: "int24",
              internalType: "int24",
            },
          ],
        },
        {
          type: "error",
          name: "UnauthorizedDynamicLPFeeUpdate",
          inputs: [],
        },
      ],
    },
    Permit2: {
      address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      abi: [
        {
          type: "function",
          name: "DOMAIN_SEPARATOR",
          inputs: [],
          outputs: [
            {
              name: "",
              type: "bytes32",
              internalType: "bytes32",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "allowance",
          inputs: [
            {
              name: "user",
              type: "address",
              internalType: "address",
            },
            {
              name: "token",
              type: "address",
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [
            {
              name: "amount",
              type: "uint160",
              internalType: "uint160",
            },
            {
              name: "expiration",
              type: "uint48",
              internalType: "uint48",
            },
            {
              name: "nonce",
              type: "uint48",
              internalType: "uint48",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "approve",
          inputs: [
            {
              name: "token",
              type: "address",
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              internalType: "address",
            },
            {
              name: "amount",
              type: "uint160",
              internalType: "uint160",
            },
            {
              name: "expiration",
              type: "uint48",
              internalType: "uint48",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "invalidateNonces",
          inputs: [
            {
              name: "token",
              type: "address",
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              internalType: "address",
            },
            {
              name: "newNonce",
              type: "uint48",
              internalType: "uint48",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "invalidateUnorderedNonces",
          inputs: [
            {
              name: "wordPos",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "mask",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "lockdown",
          inputs: [
            {
              name: "approvals",
              type: "tuple[]",
              internalType: "struct IAllowanceTransfer.TokenSpenderPair[]",
              components: [
                {
                  name: "token",
                  type: "address",
                  internalType: "address",
                },
                {
                  name: "spender",
                  type: "address",
                  internalType: "address",
                },
              ],
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "nonceBitmap",
          inputs: [
            {
              name: "",
              type: "address",
              internalType: "address",
            },
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          outputs: [
            {
              name: "",
              type: "uint256",
              internalType: "uint256",
            },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "permit",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "permitBatch",
              type: "tuple",
              internalType: "struct IAllowanceTransfer.PermitBatch",
              components: [
                {
                  name: "details",
                  type: "tuple[]",
                  internalType: "struct IAllowanceTransfer.PermitDetails[]",
                  components: [
                    {
                      name: "token",
                      type: "address",
                      internalType: "address",
                    },
                    {
                      name: "amount",
                      type: "uint160",
                      internalType: "uint160",
                    },
                    {
                      name: "expiration",
                      type: "uint48",
                      internalType: "uint48",
                    },
                    {
                      name: "nonce",
                      type: "uint48",
                      internalType: "uint48",
                    },
                  ],
                },
                {
                  name: "spender",
                  type: "address",
                  internalType: "address",
                },
                {
                  name: "sigDeadline",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "signature",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "permit",
          inputs: [
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "permitSingle",
              type: "tuple",
              internalType: "struct IAllowanceTransfer.PermitSingle",
              components: [
                {
                  name: "details",
                  type: "tuple",
                  internalType: "struct IAllowanceTransfer.PermitDetails",
                  components: [
                    {
                      name: "token",
                      type: "address",
                      internalType: "address",
                    },
                    {
                      name: "amount",
                      type: "uint160",
                      internalType: "uint160",
                    },
                    {
                      name: "expiration",
                      type: "uint48",
                      internalType: "uint48",
                    },
                    {
                      name: "nonce",
                      type: "uint48",
                      internalType: "uint48",
                    },
                  ],
                },
                {
                  name: "spender",
                  type: "address",
                  internalType: "address",
                },
                {
                  name: "sigDeadline",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "signature",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "permitTransferFrom",
          inputs: [
            {
              name: "permit",
              type: "tuple",
              internalType: "struct ISignatureTransfer.PermitTransferFrom",
              components: [
                {
                  name: "permitted",
                  type: "tuple",
                  internalType: "struct ISignatureTransfer.TokenPermissions",
                  components: [
                    {
                      name: "token",
                      type: "address",
                      internalType: "address",
                    },
                    {
                      name: "amount",
                      type: "uint256",
                      internalType: "uint256",
                    },
                  ],
                },
                {
                  name: "nonce",
                  type: "uint256",
                  internalType: "uint256",
                },
                {
                  name: "deadline",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "transferDetails",
              type: "tuple",
              internalType: "struct ISignatureTransfer.SignatureTransferDetails",
              components: [
                {
                  name: "to",
                  type: "address",
                  internalType: "address",
                },
                {
                  name: "requestedAmount",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "signature",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "permitTransferFrom",
          inputs: [
            {
              name: "permit",
              type: "tuple",
              internalType: "struct ISignatureTransfer.PermitBatchTransferFrom",
              components: [
                {
                  name: "permitted",
                  type: "tuple[]",
                  internalType: "struct ISignatureTransfer.TokenPermissions[]",
                  components: [
                    {
                      name: "token",
                      type: "address",
                      internalType: "address",
                    },
                    {
                      name: "amount",
                      type: "uint256",
                      internalType: "uint256",
                    },
                  ],
                },
                {
                  name: "nonce",
                  type: "uint256",
                  internalType: "uint256",
                },
                {
                  name: "deadline",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "transferDetails",
              type: "tuple[]",
              internalType: "struct ISignatureTransfer.SignatureTransferDetails[]",
              components: [
                {
                  name: "to",
                  type: "address",
                  internalType: "address",
                },
                {
                  name: "requestedAmount",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "signature",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "permitWitnessTransferFrom",
          inputs: [
            {
              name: "permit",
              type: "tuple",
              internalType: "struct ISignatureTransfer.PermitTransferFrom",
              components: [
                {
                  name: "permitted",
                  type: "tuple",
                  internalType: "struct ISignatureTransfer.TokenPermissions",
                  components: [
                    {
                      name: "token",
                      type: "address",
                      internalType: "address",
                    },
                    {
                      name: "amount",
                      type: "uint256",
                      internalType: "uint256",
                    },
                  ],
                },
                {
                  name: "nonce",
                  type: "uint256",
                  internalType: "uint256",
                },
                {
                  name: "deadline",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "transferDetails",
              type: "tuple",
              internalType: "struct ISignatureTransfer.SignatureTransferDetails",
              components: [
                {
                  name: "to",
                  type: "address",
                  internalType: "address",
                },
                {
                  name: "requestedAmount",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "witness",
              type: "bytes32",
              internalType: "bytes32",
            },
            {
              name: "witnessTypeString",
              type: "string",
              internalType: "string",
            },
            {
              name: "signature",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "permitWitnessTransferFrom",
          inputs: [
            {
              name: "permit",
              type: "tuple",
              internalType: "struct ISignatureTransfer.PermitBatchTransferFrom",
              components: [
                {
                  name: "permitted",
                  type: "tuple[]",
                  internalType: "struct ISignatureTransfer.TokenPermissions[]",
                  components: [
                    {
                      name: "token",
                      type: "address",
                      internalType: "address",
                    },
                    {
                      name: "amount",
                      type: "uint256",
                      internalType: "uint256",
                    },
                  ],
                },
                {
                  name: "nonce",
                  type: "uint256",
                  internalType: "uint256",
                },
                {
                  name: "deadline",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "transferDetails",
              type: "tuple[]",
              internalType: "struct ISignatureTransfer.SignatureTransferDetails[]",
              components: [
                {
                  name: "to",
                  type: "address",
                  internalType: "address",
                },
                {
                  name: "requestedAmount",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "owner",
              type: "address",
              internalType: "address",
            },
            {
              name: "witness",
              type: "bytes32",
              internalType: "bytes32",
            },
            {
              name: "witnessTypeString",
              type: "string",
              internalType: "string",
            },
            {
              name: "signature",
              type: "bytes",
              internalType: "bytes",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "transferFrom",
          inputs: [
            {
              name: "transferDetails",
              type: "tuple[]",
              internalType: "struct IAllowanceTransfer.AllowanceTransferDetails[]",
              components: [
                {
                  name: "from",
                  type: "address",
                  internalType: "address",
                },
                {
                  name: "to",
                  type: "address",
                  internalType: "address",
                },
                {
                  name: "amount",
                  type: "uint160",
                  internalType: "uint160",
                },
                {
                  name: "token",
                  type: "address",
                  internalType: "address",
                },
              ],
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "transferFrom",
          inputs: [
            {
              name: "from",
              type: "address",
              internalType: "address",
            },
            {
              name: "to",
              type: "address",
              internalType: "address",
            },
            {
              name: "amount",
              type: "uint160",
              internalType: "uint160",
            },
            {
              name: "token",
              type: "address",
              internalType: "address",
            },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "event",
          name: "Approval",
          inputs: [
            {
              name: "owner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "token",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "amount",
              type: "uint160",
              indexed: false,
              internalType: "uint160",
            },
            {
              name: "expiration",
              type: "uint48",
              indexed: false,
              internalType: "uint48",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "Lockdown",
          inputs: [
            {
              name: "owner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "token",
              type: "address",
              indexed: false,
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              indexed: false,
              internalType: "address",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "NonceInvalidation",
          inputs: [
            {
              name: "owner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "token",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "newNonce",
              type: "uint48",
              indexed: false,
              internalType: "uint48",
            },
            {
              name: "oldNonce",
              type: "uint48",
              indexed: false,
              internalType: "uint48",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "Permit",
          inputs: [
            {
              name: "owner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "token",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "spender",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "amount",
              type: "uint160",
              indexed: false,
              internalType: "uint160",
            },
            {
              name: "expiration",
              type: "uint48",
              indexed: false,
              internalType: "uint48",
            },
            {
              name: "nonce",
              type: "uint48",
              indexed: false,
              internalType: "uint48",
            },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "UnorderedNonceInvalidation",
          inputs: [
            {
              name: "owner",
              type: "address",
              indexed: true,
              internalType: "address",
            },
            {
              name: "word",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
            {
              name: "mask",
              type: "uint256",
              indexed: false,
              internalType: "uint256",
            },
          ],
          anonymous: false,
        },
        {
          type: "error",
          name: "AllowanceExpired",
          inputs: [
            {
              name: "deadline",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "ExcessiveInvalidation",
          inputs: [],
        },
        {
          type: "error",
          name: "InsufficientAllowance",
          inputs: [
            {
              name: "amount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "InvalidAmount",
          inputs: [
            {
              name: "maxAmount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          type: "error",
          name: "LengthMismatch",
          inputs: [],
        },
      ] as const,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
