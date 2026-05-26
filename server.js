const express = require('express');
const axios = require('axios');
const app = express();

// --- CONFIGURATION (Change these values!) ---
const TELEGRAM_TOKEN = 'type_here'; 
const TELEGRAM_CHAT_ID = 'type_heree';

// Top High-Volume Nifty Stocks (Expand this array as needed)
const NSE_TICKERS = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ITC.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'ICICIBANK.NS', 'TATAMOTORS.NS', 'AXISBANK.NS'];

// Helper to calculate RSI
function calculateRSI(prices, period = 14) {
    if (prices.length <= period) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period; let avgLoss = losses / period;
    for (let i = period + 1; i < prices.length; i++) {
        let diff = prices[i] - prices[i - 1];
        avgGain = (avgGain * 13 + (diff > 0 ? diff : 0)) / 14;
        avgLoss = (avgLoss * 13 + (diff < 0 ? -diff : 0)) / 14;
    }
    if (avgLoss === 0) return 100;
    return 100 - (100 / (1 + (avgGain / avgLoss)));
}

// Function to send Telegram messages
async function sendTelegramAlert(message) {
    const url = `https://telegram.org{TELEGRAM_TOKEN}/sendMessage`;
    try {
        await axios.post(url, { chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' });
    } catch (err) {
        console.error("Telegram error:", err.message);
    }
}

// Main Scanner Route
app.get('/scan', async (req, res) => {
    let alerts = [];
    
    for (let ticker of NSE_TICKERS) {
        try {
            const url = `https://yahoo.com{ticker}?range=60d&interval=1d`;
            const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            
            const indicators = response.data.chart.result[0].indicators.quote[0];
            const closes = indicators.close.filter(c => c !== null);
            const volumes = indicators.volume.filter(v => v !== null);
            
            if (closes.length < 20) continue;

            const latestPrice = closes[closes.length - 1];
            const latestVolume = volumes[volumes.length - 1];
            const last20Volumes = volumes.slice(-20);
            const avgVolume = last20Volumes.reduce((a, b) => a + b, 0) / 20;
            const rsi = calculateRSI(closes);

            // Strategy: Volume > 2x Avg AND RSI between 60 and 85
            if (latestVolume > (avgVolume * 2) && rsi > 60 && rsi < 85) {
                alerts.push(`🚀 *${ticker.replace('.NS', '')}*\n💰 Price: ₹${latestPrice.toFixed(2)}\n📊 Vol Spike: ${(latestVolume / avgVolume).toFixed(1)}x\n📈 RSI: ${rsi.toFixed(1)}`);
            }
        } catch (e) {
            console.log(`Skipped ${ticker}`);
        }
    }

    if (alerts.length > 0) {
        const fullMessage = `🔔 *NSE Breakout Alert* 🔔\n\n${alerts.join('\n\n')}`;
        await sendTelegramAlert(fullMessage);
        res.send(`Scan complete. Found ${alerts.length} stocks. Alerts sent!`);
    } else {
        res.send("Scan complete. No breakout stocks found.");
    }
});

// Home route to check if server is awake
app.get('/', (req, res) => res.send("Scanner Server is Live!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
