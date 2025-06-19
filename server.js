const express = require('express');
const cors = require('cors');
const axios = require('axios');
const UserAgent = require('user-agents');
// NEW: Import the necessary proxy agents for SOCKS and HTTPS proxies
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();

app.use(cors());
app.use(express.json());

app.post('/check-proxy', async (req, res) => {
  // The 'proxy' variable is the full URL string, e.g., "socks5://user:pass@host:port"
  const { proxy } = req.body;

  if (!proxy) {
    return res.status(400).json({ error: 'Proxy is required' });
  }

  try {
    const userAgent = new UserAgent().toString();
    const proxyUrl = new URL(proxy);

    // Main configuration for our Axios request
    const axiosConfig = {
      headers: { 'User-Agent': userAgent },
      timeout: 15000 // Increased timeout for potentially slow proxies
    };

    // NEW: Conditionally set the correct agent based on the proxy protocol.
    // For requests to an 'https' URL like 'https://api.myip.com', we must use an httpsAgent.
    if (proxyUrl.protocol === 'socks5:') {
      axiosConfig.httpsAgent = new SocksProxyAgent(proxy);
      axiosConfig.proxy = false; // Important: Disable Axios's default proxy handling when using a specific agent
    } else if (proxyUrl.protocol === 'http:' || proxyUrl.protocol === 'https:') {
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxy);
      axiosConfig.proxy = false; // Also important for HTTPS proxies to ensure the agent is used
    } else {
      // Handle unsupported protocols
      return res.status(400).json({ status: 'not working', error: 'Unsupported proxy protocol' });
    }

    // Make the request to the target URL using the configured agent
    const response = await axios.get('https://api.myip.com', axiosConfig);

    // If the request is successful, return the proxy status and data
    res.json({
      proxy,
      status: 'working',
      ip: response.data.ip,
      country: response.data.country,
      isp: response.data.cc // 'cc' is the country code, which you are using as ISP
    });

  } catch (error) {
    // Provide more specific and user-friendly error messages
    let errorMessage = error.message;
    if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
        errorMessage = 'Proxy connection timed out.';
    } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Proxy connection refused.';
    } else if (error.response) {
        errorMessage = `Proxy returned status: ${error.response.status}`;
    }
    
    // Return a 'not working' status with the specific error
    res.json({
      proxy,
      status: 'not working',
      error: errorMessage
    });
  }
});

// The old parseProxy function is no longer needed as the agents handle the URL string directly.

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy Checker server running on port ${PORT}`);
});

