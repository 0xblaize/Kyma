'use client'

import { useEffect, useRef } from 'react'
import { useDashboardState } from './useDashboardState'

export function useMockEngine() {
  const {
    lifecycle,
    resetNonce,
    selectedMarket,
    pushTick,
    pushLog,
    pushOrderBlock,
    openPosition,
  } = useDashboardState()

  const wsRef = useRef<WebSocket | null>(null)
  const marketRef = useRef(selectedMarket)

  useEffect(() => {
    marketRef.current = selectedMarket
  }, [selectedMarket])

  useEffect(() => {
    if (lifecycle !== 'active') {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      return
    }

    const ws = new WebSocket('ws://localhost:8000/ws')
    wsRef.current = ws

    ws.onopen = () => {
      console.log('Connected to Kyma backend')
      ws.send('START_ENGINE')
    }

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const data = payload.data
        switch (payload.event) {
          case 'market_tick':
            if (data.symbol === marketRef.current) {
              pushTick(data.price)
            }
            break
          case 'agent_log':
            pushLog(data)
            break
          case 'smc_pattern_detected':
            pushOrderBlock({
                priceLevel: data.priceLevel,
                direction: data.direction,
                asset: data.asset,
                createdAt: Date.now()
            })
            break
          case 'trade_execution':
            openPosition({
                tradeId: data.tradeId,
                symbol: data.symbol,
                side: data.side,
                sizeUsdt: data.sizeUsdt,
                qty: (data.sizeUsdt * data.leverage) / data.entryPrice,
                leverage: data.leverage,
                entryPrice: data.entryPrice,
                stopLoss: data.stopLoss,
                takeProfit: data.takeProfit,
                liqPrice: 0,
                riskTier: 'BASE',
                markPrice: data.entryPrice,
                pnl: 0
            })
            break
          case 'portfolio_update':
            break
        }
      } catch (e) {
        console.error('WS Error parsing data', e)
      }
    }

    return () => {
      ws.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycle, resetNonce])
}
