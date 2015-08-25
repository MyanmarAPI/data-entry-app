var unknowns = [];
var set_keys = [];
var set_fields = [];
var clicked = false;

// repeat form.json - match fields to language labels
var labels = [
  { "label": "ကိုယ်စားလှယ်လောင်း၏အမည်", "field": "full_name" },
  { "label": "ရပ်ကွက်/ကျေးရွာအုပ်စု အမည်", "field":"ward_village"},
  { "label": "မဲစာရင်းအမှတ်စဉ်", "field": "voter_list_number" },
  { "label": "လူမျိုး", "field": "nationality" },
  { "label": "ဘာသာ", "field": "religion" },
  { "label": "ပညာအရည်အချင်း", "field": "education" },
  { "label": "အလုပ်အကိုင်", "field": "occupation" },
  { "label": "အမြဲတမ်းနေရပ်လိပ်စာ", "field": "address_perm" },
  { "label": "လက်ရှိနေရပ်လိပ်စာ", "field": "address_mail" },
  { "label": "ရွေးကောက်တင်မြှောက်ခံလိုသည့် မဲဆန္ဒနယ်အမည်", "field": "constituency_name" },
  { "label": "မဲဆန္ဒနယ်အမှတ်", "field": "constituency_number" },
  { "label": "မိမိကိုယ်စားပြုသောပါတီအဖွဲ့အစည်းအမည် သို့မဟုတ် တစ်သီးပုဂ္ဂလ သို့မဟုတ် သက်ဆိုင်ရာ တိုင်းရင်းသားလူမျိုးအမည်","field": "party" },
  { "label": "ဖခင် - အဘအမည်", "field": "father" },
  { "label": "ဖခင် - လူမျိုး", "field": "father_ethnicity" },
  { "label": "ဖခင် - ဘာသာ", "field": "father_religion" },
  { "label": "မိခင် - အမိအမည်", "field": "mother" },
  { "label": "မိခင် - လူမျိုး", "field": "mother_ethnicity" },
  { "label": "မိခင် - ဘာသာ", "field": "mother_religion" }
];

function fixOrder(original_entry, key) {
  // normalize strings here
  // different ways to type diacritics in Myanmar3
  // fix spacing
  // use Myanmar punctuation
  // remove Myanmar punctuation from the end of a value
  entry = (original_entry + "").trim();
  entry = entry.replace(/့်/g, "့်").replace(/\,/g, "၊").replace(/\−/g, "-").replace(/ည့်/g, "ည့်");
  entry = entry.replace("ဗုဒ္ဓဘာသာ", "ဗုဒ္ဓ");
  if (entry.length > 1 && entry.lastIndexOf("") === entry.length - 1 || entry.lastIndexOf("။") === entry.length - 1) {
    entry = entry.substring(0, entry.length - 1);
  }
  if (entry !== original_entry + "") {
    set_fields.push({ key: key, selection: entry });
  }
  return entry;
}

function revertTo(key, original, original2) {
  // give the user another chance at answering the last question
  // remove record of previously answering that question
  return function() {
    $("#back").hide();
    if (set_keys.indexOf(key) > -1) {
      set_keys.splice(set_keys.indexOf(key), 100);
    }
    matches[0][key] = original;
    if (original2) {
      matches[1][key] = original2;
    }
    queryMatch();
  };
}

function linkButton(i, key, val) {
  // clicking this button should set the field and continue on
  $($("button")[i]).off("click").click(function() {
    clicked = true;
    set_fields.push({
      key: key,
      selection: val
    });
    var original;
    if (matches[0][key] === val) {
      original = matches[1][key];
    } else {
      original = matches[0][key];
    }
    $("#back")
      .show()
      .off("click")
      .click(revertTo(key, original));
    matches[0][key] = val;
    matches[1][key] = val;
    queryMatch();
  });
}

function queryMatch() {
  // show the next human decision for this data

  // avoid strings which should be different anyway
  var boring_keys = ["saved", "id", "user_id", "mother_name"]; // mother_name was a mistaken column!

  // avoid strings which a person cannot find out by looking
  var skip_keys = ["dob", "ward_village", "house", "father_id", "mother_id", "national_id", "norm_national_id"];

  var found_bug = false;

  for (var key in matches[0]) {
    // avoid repeating or unchanging keys
    if (boring_keys.indexOf(key) > -1 || set_keys.indexOf(key) > -1) {
      continue;
    }

    // make small edits, make a note of the change
    matches[0][key] = fixOrder(matches[0][key], key);
    matches[1][key] = fixOrder(matches[1][key], key);
    set_keys.push(key);

    var xslug = (matches[0][key] + "").toLowerCase().replace(/\s/g, '');
    var yslug = (matches[1][key] + "").toLowerCase().replace(/\s/g, '');
    if (xslug != yslug) {
      // if this is a field that the user cannot correct
      // remember the uncertainty
      if (skip_keys.indexOf(key) > -1) {
        if (unknowns.indexOf(key) === -1) {
          unknowns.push(key);
        }
        continue;
      }

      // show Myanmar label for this field
      for (var f = 0; f < labels.length; f++) {
        if (labels[f].field === key) {
          $("label").text(labels[f].label);
          break;
        }
      }

      // set buttons to any matches' values
      for (var m = 0; m < matches.length; m++) {
        $($("button")[m]).text(matches[m][key]);

        // tell button to make decision on click
        linkButton(m, key, matches[m][key]);
      }

      // user free response should show matching text up until the difference occurs
      $("textarea").val(matches[0][key]);
      for (var c = 0; c < xslug.length; c++) {
        if (yslug.length >= c && xslug[c] === yslug[c]) {
          continue;
        }
        $("textarea").val(xslug.substring(0, c));
        break;
      }
      // clicking Save Changes advances the program
      $("#correct").off("click").click(function() {
        clicked = true;
        var backfn = revertTo(key, matches[0][key], matches[1][key]);
        $("#back").show()
          .off("click")
          .click(backfn);
        matches[0][key] = $("textarea").val();
        matches[1][key] = $("textarea").val();
        set_fields.push({
          key: key,
          selection: matches[0][key]
        });
        queryMatch();
      });

      // clicking Skip adds this field to unknowns and keeps going
      $("#skip").off("click").click(function() {
        clicked = true;
        unknowns.push(key);
        var original;
        if (matches[0][key].length > matches[1][key].length) {
          original = matches[1][key];
          matches[1][key] = matches[0][key];
        } else {
          original = matches[0][key];
          matches[0][key] = matches[1][key];
        }
        set_fields.push({
          key: key,
          selection: matches[0][key]
        });
        $("#back").show()
          .off("click")
          .click(revertTo(key, original));
        queryMatch();
      });

      found_bug = true;
      break;
    }
  }

  if (!found_bug) {
    // when you reach the end of conflicts on this form
    // post and get a new form
    $("#back").hide();
    var msg = { unknowns: unknowns, set_fields: set_fields };
    if (!clicked) {
      $.post("/errors/" + matches[0].id + "/" + matches[1].id, msg, function(data) {
        window.location.reload();
      });
    } else {
      $("label, button, textarea").hide();
      $("#back").show().off("click").click(function() {
        $("label, button, textarea").show();
        $("#back, #next").hide();
      });
      $("#next").show();
    }
  }
}

// after finishing a user, last choice to go back or advance
$("#next").hide().click(function() {
  var msg = { unknowns: unknowns, set_fields: set_fields };
  $.post("/errors/" + matches[0].id + "/" + matches[1].id, msg, function(data) {
    window.location.reload();
  });
});

queryMatch();
$("#back").hide();
