const express = require('express');
const axios = require('axios');
const ProxyAgent = require('proxy-agent');

const app = express();
app.use(express.json());

// دالة للتحقق من صحة رابط البروكسي
function isValidProxyUrl(url) {
  const regex = /^(socks5|http|https):\/\/(?:\S+:\S+@)?[\w.-]+:\d+$/;
  return regex.test(url);
}

// دالة لفحص البروكسي
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
      city: ipInfoResp.data.city
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// نقطة النهاية لفحص البروكسي
app.post('/check-proxy', async (req, res) => {
  const { proxy } = req.body;
  if (!proxy) {
    return res.status(400).json({ success: false, message: 'Proxy URL required' });
  }

  if (!isValidProxyUrl(proxy)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid proxy format. Use: protocol://[user:pass@]host:port'
    });
  }

  const result = await checkProxy(proxy);
  res.json(result);
});

// تشغيّل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
