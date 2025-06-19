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

    // ** SOLUTION: The target URL is changed to a more detailed API **
    // The request will be sent *through the proxy* to this URL.
    // The API will then return details about the proxy's IP address.
    const targetUrl = 'http://ip-api.com/json';

    if (proxyUrl.protocol === 'socks4:' || proxyUrl.protocol === 'socks5:') {
      // For SOCKS proxies, the target must be HTTP, not HTTPS
      axiosConfig.httpsAgent = new SocksProxyAgent(proxy);
      axiosConfig.proxy = false; 
    } else if (proxyUrl.protocol === 'http:' || proxyUrl.protocol === 'https:') {
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxy);
      axiosConfig.proxy = false; 
    } else {
      return res.status(400).json({ status: 'not working', error: 'Unsupported proxy protocol' });
    }

    const response = await axios.get(targetUrl, axiosConfig);

    // If the API request fails internally, it reports a 'fail' status
    if (response.data.status === 'fail') {
      throw new Error(`IP-API failed to get info: ${response.data.message}`);
    }

    // ** SOLUTION: Map the new, more detailed fields correctly **
    res.json({
      proxy,
      status: 'working',
      ip: response.data.query, // The IP address checked
      country: response.data.country,
      isp: response.data.isp,     // Correct ISP name
      city: response.data.city,   // City information
      region: response.data.regionName // Region/State information
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

