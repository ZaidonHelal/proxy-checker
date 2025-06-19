const express = require('express');
const cors = require('cors');
const axios = require('axios');
const UserAgent = require('user-agents');
const app = express();

app.use(cors()); // ✅ تم تفعيل CORS
app.use(express.json());

app.post('/check-proxy', async (req, res) => {
  const { proxy } = req.body;

  if (!proxy) {
    return res.status(400).json({ error: 'Proxy is required' });
  }

  try {
    const userAgent = new UserAgent().toString();
    const response = await axios.get('https://api.myip.com', {
      proxy: parseProxy(proxy),
      headers: {
        'User-Agent': userAgent
      },
      timeout: 10000
    });

    res.json({
      proxy,
      status: 'working',
      ip: response.data.ip,
      country: response.data.country,
      isp: response.data.cc
    });
  } catch (error) {
    res.json({
      proxy,
      status: 'not working',
      error: error.message
    });
  }
});

function parseProxy(proxyUrl) {
  const url = new URL(proxyUrl);
  const [username, password] = url.username ? [url.username, url.password] : [undefined, undefined];

  return {
    host: url.hostname,
    port: parseInt(url.port),
    protocol: url.protocol.replace(':', ''),
    auth: username ? { username, password } : undefined
  };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy Checker server running on port ${PORT}`);
});
