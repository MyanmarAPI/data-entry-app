
// basic HTTP

var fs = require("fs");

var sqlite3 = require("sqlite3");

var db = new sqlite3.Database('./database.sqlite3');

var prev_name = null;
var prev_id = null;

var alphabet = "ကခဂဃငစဆဇစျညဋဌဍဎဏတထဒဓနပဖဗဘမယရလဝသဟဠအ";

var prefixes = [
  "ဒေါ်",
  "Dr.",
  "Dr",
  "MD",
  "ဦး",
  "ဒေါက်တ"
];

var outdata= [];
var name_problems = [];
var id_problems = [];

var expectMatch = false;

db.all("SELECT full_name, norm_national_id FROM entries ORDER BY full_name", function(err, rows) {
  for (var r = 0; r < rows.length; r++) {
    if (!isNaN(rows[r].full_name * 1) || !isNaN(rows[r].norm_national_id * 1)) {
        continue;
    }

   var name_slug = rows[r].full_name.replace(/\s/g, '');
   var id_slug = rows[r].norm_national_id.replace(/\s/g, '');

    if (prev_name != name_slug && prev_id != id_slug) {
        // starting a name with no connection to the old
        outdata.push(rows[r].full_name.trim() + " (" + rows[r].norm_national_id.trim() + ")");
    } else {
        // based on previous name or id
        if (prev_name !== name_slug) {
            var namediff = "";
            for (var c = 0; c < prev_name.length; c++) {
                if (prev_name[c] === name_slug[c]) {
                  namediff += prev_name[c];
                } else { break; }
            }
            name_problems.push(prev_name + " AND " + name_slug + ": " + namediff + "_?");
        } else {
            var iddiff= "";
            for (var c = 0; c < prev_id.length; c++) {
                if (prev_id[c] === id_slug[c]) {
                  iddiff += prev_id[c];
                } else { break; }
            }
            id_problems.push(prev_id + " AND " + id_slug + ": " + iddiff + "_?");
        }
    }
    prev_name = name_slug;
    prev_id = id_slug;
  }
  outdata.sort(function(a, b) {
    var aname = a;
    var bname = b;
    for (var p = 0; p < prefixes.length; p++) {
      aname = aname.replace(prefixes[p], '').trim();
      bname = bname.replace(prefixes[p], '').trim();
    }
    for (var i = 0; i < Math.min(aname.length, bname.length); i++) {
      if (alphabet.indexOf(aname[i]) !== alphabet.indexOf(bname[i])) {
        return alphabet.indexOf(aname[i]) - alphabet.indexOf(bname[i]);
      }
    }
    // letters matched so far
    return a.length - b.length;
  });
  // fs.writeFile("candidates.txt", outdata.join("\r\n"), { encoding: "utf-8"}, null);
  fs.writeFile("errors.txt", "NAMES\r\n" + name_problems.join("\r\n") + "\r\nIDs\r\n" + id_problems.join("\r\n"), { encoding: "utf-8"}, null);
});
