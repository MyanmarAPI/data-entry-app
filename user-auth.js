var crypto = require("crypto");
var LocalStrategy = require('passport-local').Strategy;

module.exports = {
  createUser: function(req, db, callback) {
    db.get("INSERT INTO users (username, password, salt) VALUES ('" + [req.body.username, req.body.password, process.env.SALT || 'ekcweio92dmqbd'].join("','") + "')", function(err) {
      if (err) {
        throw err;
      }
      callback();
    });
  },

  setupAuth: function(passport, db) {
    var hashPassword = function(password, salt) {
      var hash = crypto.createHash('sha256');
      hash.update(password);
      hash.update(salt);
      return hash.digest('hex');
    }

    passport.use(new LocalStrategy(function(username, password, done) {
      console.log('passport using');
      db.get('SELECT salt FROM users WHERE username = ?', username, function(err, row) {
        if (!row) {
          console.log('no row fail');
          return done(null, false);
        }
        var hash = hashPassword(password, row.salt);
        db.get('SELECT username, id FROM users WHERE username = ? AND password = ?', username, hash, function(err, row) {
          if (!row) {
            console.log('no password fail');
            return done(null, false);
          }
          return done(null, row);
        });
      });
    }));

    passport.serializeUser(function(user, done) {
      return done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
      db.get('SELECT id, username FROM users WHERE id = ?', id, function(err, row) {
        if (!row) return done(null, false);
        return done(null, row);
      });
    });
  }
}
