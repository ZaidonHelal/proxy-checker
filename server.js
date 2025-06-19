const express = require('express');
const axios = require('axios');
const ProxyAgent = require('proxy-agent');
const speedTest = require('speedtest-net');

const app = express();
app.use(express.json());

function isValidProxyUrl(url) {
  const regex = /^(socks5|http|https):\/\/(?:\S+:\S+@)?[\w.-]+:\d+$/;
  return regex.test(url);
}

async function checkProxy(proxyUrl) {
  try {
    const agent = new ProxyAgent(proxyUrl);
    const response = await axios.get('https://api.ipify.org?format=json', {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 7000,
    });

    if (response.status !== 200) {
      return { success: false, message: 'Failed to connect via proxy' };
    }

    const ip = response.data.ip;

    const ipInfoResp = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 5000 });
    if (ipInfoResp.data.status !== 'success') {
      return { success: false, message: 'Failed to get IP info' };
    }

    return {
      success: true,
      ip,
      isp: ipInfoResp.data.isp,
      country: ipInfoResp.data.country,
      city: ipInfoResp.data.city,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

app.post('/check-proxy', async (req, res) => {
  const { proxy } = req.body;
  if (!proxy) {
    return res.status(400).json({ success: false, message: 'Proxy URL required' });
  }

  if (!isValidProxyUrl(proxy)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid proxy format. Use: protocol://[user:pass@]host:port',
    });
  }

  const result = await checkProxy(proxy);
  res.json(result);
});

app.post('/speed-test', async (req, res) => {
  const { proxy } = req.body;
  if (!proxy) {
    return res.status(400).json({ success: false, message: 'Proxy URL required' });
  }

  if (!isValidProxyUrl(proxy)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid proxy format. Use: protocol://[user:pass@]host:port',
    });
  }

  try {
    const agent = new ProxyAgent(proxy);
    const start = Date.now();

    const response = await axios.get('https://speed.hetzner.de/100MB.bin', {
      responseType: 'stream',
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 20000,
    });

    let downloaded = 0;
    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
    });

    response.data.on('end', () => {
      const duration = (Date.now() - start) / 1000;
      const speedMbps = (downloaded * 8) / (duration * 1024 * 1024);
      res.json({ success: true, speedMbps: speedMbps.toFixed(2) });
    });

    response.data.on('error', (err) => {
      res.json({ success: false, message: err.message });
    });

  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
