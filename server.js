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

    const result = await speedTest({
      acceptLicense: true,
      acceptGdpr: true,
      httpsAgent: agent,
      httpAgent: agent,
      timeout: 15000
    });

    res.json({
      success: true,
      downloadMbps: result.download.bandwidth / 125000,
      uploadMbps: result.upload.bandwidth / 125000,
      ping: result.ping.latency,
      isp: result.isp,
      server: result.server.name
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
