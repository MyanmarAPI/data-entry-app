var fs = require('fs');
var csv = require('fast-csv');

var sqlite3 = require("sqlite3");
var matches = new sqlite3.Database('./database.sqlite3');

var gj = require('./data/lower_house_geo.json');

var lower = require('./data/lower_house.json');
var lookup = {};
for (var i = 0; i < lower.length; i++) {
  lookup[lower[i].area] = lower[i].type;
}
var bannames = require('./data/bannames.json');
var mpids = require('./data/mpids.json');
var id_by_party_name = require('./data/idbp.json');
var fixnames = require('./data/fixnames.json');

var candidates = [];
var badparties = [];
csv.fromPath('./lower_house_candidates.csv', { headers: true })
  .on('data', function (row) {
    if (!row.full_name || !row.full_name.length || !row.photo_id || bannames.indexOf(row.full_name.replace(/\s/g, '')) > -1) {
      return;
    }

    var mpid = null;
    for (var c = 0; c < mpids.length; c++) {
      if (row.photo_id * 1 === mpids[c][1]) {
        mpid = mpids[c][0];
        break;
      }
    }

    var partyid = null;
    var partyname = row.party.replace(/\s/g, '');

    for (var f = 0; f < fixnames.length; f++) {
      if (partyname.indexOf(fixnames[f][0]) > -1) {
        partyid = fixnames[f][1];
        partyname = id_by_party_name[partyid - 1][1];
      }
    }
    if (partyname.indexOf('ပအိုဝ်းအမျိုးသားအဖွဲ့ချုပ်ပါတီ') === 0) {
      partyname = 'ပအိုဝ်းအမျိုးသားအဖွဲ့ချုပ်(PNO)ပါတီ';
    }

    partyname = partyname.replace('ရခိုင်အမျိုးသ','ရခိုင်ပြည်နယ်အမျိုးသ');

    for (var i = 0; i < id_by_party_name.length; i++) {
      if (id_by_party_name[i][1].replace(/\s/g, '') === partyname) {
        partyid = id_by_party_name[i][0];
        break;
      }
    }
    if (!partyid && badparties.indexOf(partyname) === -1) {
      badparties.push(partyname);
    }

    var st_pcode = null;
    var dt_pcode = null;
    var ts_pcode = null;
    for (var f = 0; f < gj.features.length; f++) {
       if (gj.features[f].properties.Myanmar3.replace(/ပြည်နယ်|မြို့နယ်|တိုင်းဒေသကြီး|မဲဆန္ဒနယ်/g, '') === row.constituency_name.replace(/ပြည်နယ်|မြို့နယ်|တိုင်းဒေသကြီး|မဲဆန္ဒနယ်/g, '')) {
         st_pcode = gj.features[f].properties.ST_PCODE;
         dt_pcode = gj.features[f].properties.DT_PCODE;
         ts_pcode = gj.features[f].properties.TS_PCODE;
         break;
      }
    }
    if (!st_pcode) {
      console.log(row.constituency_name.replace(/ပြည်နယ်|မြို့နယ်|တိုင်းဒေသကြီး|မဲဆန္ဒနယ်/g, ''));
    }

    candidates.push({
      "name": row.full_name,
      "mpid": mpid,
      "gender": row.gender,
      "photo_url": row.photo_id,
      "legislature": row.house,
      "birthdate": {
        "$date": (new Date(row.birthdate) * 1)
      },
      "education": row.education,
      "occupation": row.occupation,
      "ethnicity": row.nationality,
      "religion": row.religion,
      "ward_village": row.ward_village,
      "constituency": {
          "name": row.constituency_name,
          "number": 0, // 0 for lower house, 1-2 for state, 1-12 for upper house
          "ST_PCODE": st_pcode,
          "DT_PCODE": dt_pcode,
          "TS_PCODE": ts_pcode,
          "parent": row.state,
          "parent_type": lookup[row.state], // possible values: state, region, territory
      },
      "party_id": partyid,
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
    var writeStream = fs.createWriteStream('./final_lower_house.json');
    var known_ids = [];
    var fixURL = function (i) {

      if (candidates[i].photo_url && known_ids.indexOf(candidates[i].photo_url) > -1) {
        console.log(candidates[i].photo_url);
      }
      known_ids.push(candidates[i].photo_url);

      matches.get('SELECT scan_file FROM forms WHERE id = ?', candidates[i].photo_url, function (err, row) {
        if (err) {
          throw err;
        }

        if (!row || !row.scan_file) {
          console.log(i);
          console.log(candidates[i]);
          throw 'no scan_file';
        }

        candidates[i].photo_url = "https://storage.googleapis.com/staticassets/candidate-photos/" + row.scan_file.replace('/color_images/', '');

        writeStream.write(JSON.stringify(candidates[i]) + "\n");

        i++;
        if (i >= candidates.length) {
          writeStream.end();
        } else {
          fixURL(i);
        }
      });
    };
    fixURL(0);
  });
