module.exports = (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify({ method: req.method, path: req.url, ok: true }));
};
