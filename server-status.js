module.exports = {
  status: function(req, res) {
    if (req.isAuthenticated()) {
      res.json({ status: { server: "ok", user: "ok" } });
    } else {
      res.json({ status: { server: "ok", user: "loggedout" } });
    }
  }
};
