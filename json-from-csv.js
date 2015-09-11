var fs = require('fs');
var csv = require('fast-csv');

var sqlite3 = require("sqlite3");
var matches = new sqlite3.Database('./database.sqlite3');


var lower = require('./data/lower_house.json');
var lookup = {};
for (var i = 0; i < lower.length; i++) {
  lookup[lower[i].area] = lower[i].type;
}

var candidates = [];
csv.fromPath('./lower_house_candidates.csv', { headers: true })
  .on('data', function (row) {
    if (!row.full_name || !row.full_name.length || !row.photo_id) {
      return;
    }
    candidates.push({
      "name": row.full_name,
      "mpid": null,
      "gender": row.gender,
      "photo_url": row.photo_id,
      "legislature": row.house,
      "birthdate": (1 * new Date(row.birthdate)),
      "education": row.education,
      "occupation": row.occupation,
      "ethnicity": row.nationality,
      "religion": row.religion,
      "ward_village": row.ward_village,
      "constituency": {
          "name": row.constituency_name,
          "number": 0, // 0 for lower house, 1-2 for state, 1-12 for upper house
          "ST_PCODE": null,
          "DT_PCODE": null,
          "parent": row.state,
          "parent_type": lookup[row.state], // possible values: state, region, territory
      },
      "party": {
          "name": row.party
      },
      "mother": {
          "name": row.mother,
          "ethnicity": row.mother_ethnicity,
          "religion": row.mother_religion
      },
      "father": {
          "name": row.father,
          "ethnicity": row.father_ethnicity,
          "religion": row.father_religion
      }
    });
  })
  .on('end', function () {
    var fixURL = function (i) {
      matches.get('SELECT scan_file FROM forms WHERE id = ?', candidates[i].photo_url, function (err, row) {
        if (err) {
          throw err;
        }

        if (!row || !row.scan_file) {
          console.log(i);
          console.log(candidates[i]);
          throw 'no scan_file';
        }

        candidates[i].photo_url = row.scan_file.replace('/color_images/', '');

        i++;
        if (i >= candidates.length) {
          fs.writeFile('./final_lower_house.json', JSON.stringify(candidates));
        } else {
          fixURL(i);
        }
      });
    };
    fixURL(0);
  });
