const express = require('express');
const cors = require('cors'); // Use the cors middleware
const axios = require('axios');
const UserAgent = require('user-agents');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();

// ✅ Crucial Step: Enable CORS for all requests.
// This will add the necessary headers (like 'Access-Control-Allow-Origin: *')
// to allow your front-end to make calls to this server.
app.use(cors()); 

app.use(express.json());

// This endpoint will be called by your front-end.
app.post('/check-proxy', async (req, res) => {
  // Your front-end will send the proxy details in the request body.
  const proxyDetails = req.body; 

  if (!proxyDetails || !proxyDetails.type || !proxyDetails.ip || !proxyDetails.port) {
    return res.status(400).json({ status: 'fail', error: 'Incomplete proxy details provided' });
  }

  try {
    const userAgent = new UserAgent().toString();
    
    // Construct the full proxy URL string from the details sent by the front-end
    let authPart = '';
    if (proxyDetails.username) {
        authPart = encodeURIComponent(proxyDetails.username);
        if (proxyDetails.password) {
            authPart += `:${encodeURIComponent(proxyDetails.password)}`;
        }
        authPart += '@';
    }
    const proxyUrlString = `${proxyDetails.type}://${authPart}${proxyDetails.ip}:${proxyDetails.port}`;
    const proxyUrl = new URL(proxyUrlString);

    const axiosConfig = {
      headers: { 'User-Agent': userAgent },
      timeout: 15000 
    };

    // The target URL for checking the IP details.
    const targetUrl = 'http://ip-api.com/json';

    // Set the correct agent based on the proxy protocol.
    if (proxyUrl.protocol === 'socks4:' || proxyUrl.protocol === 'socks5:') {
      const socksAgent = new SocksProxyAgent(proxyUrlString);
      axiosConfig.httpAgent = socksAgent; 
      axiosConfig.httpsAgent = socksAgent;
      axiosConfig.proxy = false; 
    } else if (proxyUrl.protocol === 'http:' || proxyUrl.protocol === 'https:') {
      const httpAgent = new HttpsProxyAgent(proxyUrlString);
      axiosConfig.httpAgent = httpAgent;
      axiosConfig.httpsAgent = httpAgent;
      axiosConfig.proxy = false;
    } else {
      return res.status(400).json({ status: 'fail', error: 'Unsupported proxy protocol' });
    }

    // This server makes the request to the IP API through the user's proxy.
    const response = await axios.get(targetUrl, axiosConfig);

    if (response.data.status === 'fail') {
      throw new Error(`IP-API check failed: ${response.data.message}`);
    }
    
    // Send the successful, real proxy data back to your front-end.
    res.json({
      status: 'success',
      isWorking: true,
      data: {
          up: true,
          internet: true,
          ip: response.data.query,
          country: response.data.country,
          isp: response.data.isp,
          city: response.data.city,
          regionName: response.data.regionName
      }
    });

  } catch (error) {
    let errorMessage = error.message;
    if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
        errorMessage = 'Proxy connection timed out.';
    } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Proxy connection refused.';
    }
    
    res.status(500).json({
      status: 'fail',
      isWorking: false,
      data: {
        up: false,
        reason: errorMessage
      }
    });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy Checker server running on port ${PORT}`);
});

