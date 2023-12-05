import type { BaseContext, Contract } from '@lib/adapter'
import { mapSuccessFilter } from '@lib/array'
import { multicall } from '@lib/multicall'

const abi = {
  getAssetsWithState: {
    inputs: [],
    name: 'getAssetsWithState',
    outputs: [
      {
        internalType: 'address[]',
        name: 'assets',
        type: 'address[]',
      },
      {
        components: [
          {
            internalType: 'contract IShareToken',
            name: 'collateralToken',
            type: 'address',
          },
          {
            internalType: 'contract IShareToken',
            name: 'collateralOnlyToken',
            type: 'address',
          },
          {
            internalType: 'contract IShareToken',
            name: 'debtToken',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'totalDeposits',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'collateralOnlyDeposits',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'totalBorrowAmount',
            type: 'uint256',
          },
        ],
        internalType: 'struct IBaseSilo.AssetStorage[]',
        name: 'assetsStorage',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  asset: {
    inputs: [],
    name: 'asset',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
} as const

export async function getSiloPools(ctx: BaseContext, vaults: `0x${string}`[]): Promise<Contract[]> {
  const assetsWithStatesRes = await multicall({
    ctx,
    calls: vaults.map((vault) => ({ target: vault }) as const),
    abi: abi.getAssetsWithState,
  })

  const pools: Contract[] = mapSuccessFilter(assetsWithStatesRes, (res) => {
    const [_assets, assetsStorages] = res.output

    return assetsStorages.map((assetsStorage) => {
      const { collateralToken, collateralOnlyToken, debtToken } = assetsStorage

      const lend: Contract = {
        chain: ctx.chain,
        address: collateralToken,
        vault: res.input.target,
        category: 'lend',
      }

      const lendOnlyToken: Contract = {
        chain: ctx.chain,
        address: collateralOnlyToken,
        vault: res.input.target,
        category: 'lend',
      }

      const borrow: Contract = {
        chain: ctx.chain,
        address: debtToken,
        vault: res.input.target,
        category: 'borrow',
      }

      return [lend, lendOnlyToken, borrow]
    })
  }).flat(2)

  const assetsRes = await multicall({
    ctx,
    calls: pools.map((pool) => ({ target: pool.address })),
    abi: abi.asset,
  })

  return mapSuccessFilter(assetsRes, (res, index) => ({
    chain: ctx.chain,
    address: res.output,
    silo: pools[index].vault,
    category: pools[index].category,
  }))
}
