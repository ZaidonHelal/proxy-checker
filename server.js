const express = require('express');
const bodyParser = require('body-parser');
const { HttpProxy, SocksProxy, ProxyChecker } = require('free-proxy-checker');

const app = express();
app.use(bodyParser.json());

app.post('/check', async (req, res) => {
  const { type, ip, port, username, password } = req.body;
  let proxy;
  const auth = username && password ? { username, password } : null;

  if (type === 'http') {
    proxy = new HttpProxy(ip, port, auth);
  } else {
    proxy = new SocksProxy(ip, port, auth, type === 'socks5' ? 5 : 4);
  }

  const checker = new ProxyChecker([proxy], { timeout: 5000, concurrency: 1 });
  await checker.checkProxies();
  const up = checker.getProxiesUp().length === 1;

  res.json({ up });
});

app.get("/", (req, res) => {
  res.send("Proxy Checker Server is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
