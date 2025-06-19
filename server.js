const express = require('express');
const cors = require('cors');
const axios = require('axios');
const UserAgent = require('user-agents');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();

app.use(cors());
app.use(express.json());

app.post('/check-proxy', async (req, res) => {
  const { proxy } = req.body;

  if (!proxy) {
    return res.status(400).json({ error: 'Proxy is required' });
  }

  try {
    const userAgent = new UserAgent().toString();
    const proxyUrl = new URL(proxy);

    const axiosConfig = {
      headers: { 'User-Agent': userAgent },
      timeout: 15000 
    };

    // The target URL for checking the IP details
    const targetUrl = 'http://ip-api.com/json';

    // ✅ Your proposed solution implemented here:
    if (proxyUrl.protocol === 'socks4:' || proxyUrl.protocol === 'socks5:') {
      const socksAgent = new SocksProxyAgent(proxy);
      // Using httpAgent for http:// targets, as you correctly pointed out.
      axiosConfig.httpAgent = socksAgent; 
      // Also setting httpsAgent for completeness, in case the target was HTTPS.
      axiosConfig.httpsAgent = socksAgent;
      axiosConfig.proxy = false; // Disable default proxy handling
    } else if (proxyUrl.protocol === 'http:' || proxyUrl.protocol === 'https:') {
      const httpAgent = new HttpsProxyAgent(proxy);
      // For HTTP/S proxies, HttpsProxyAgent works for both http and https targets
      axiosConfig.httpAgent = httpAgent;
      axiosConfig.httpsAgent = httpAgent;
      axiosConfig.proxy = false;
    } else {
      return res.status(400).json({ status: 'not working', error: 'Unsupported proxy protocol' });
    }

    const response = await axios.get(targetUrl, axiosConfig);

    if (response.data.status === 'fail') {
      throw new Error(`IP-API failed to get info: ${response.data.message}`);
    }

    res.json({
      proxy,
      status: 'working',
      ip: response.data.query,
      country: response.data.country,
      isp: response.data.isp,
      city: response.data.city,
      region: response.data.regionName
    });

  } catch (error) {
    let errorMessage = error.message;
    if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
        errorMessage = 'Proxy connection timed out.';
    } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Proxy connection refused.';
    } else if (error.response) {
        errorMessage = `Proxy returned status: ${error.response.status}`;
    }
    
    res.json({
      proxy,
      status: 'not working',
      error: errorMessage
    });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy Checker server running on port ${PORT}`);
});

