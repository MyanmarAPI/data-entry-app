$(function () {
  // filter down to candidates with unique IDs
  // prefer consensus_forms
  var known_candidates = [];
  var candidates = $("tr").not('.header');
  for (var c = 0; c < candidates.length; c++) {
    var candidate_id = $(candidates[c]).find('td.norm_id').text().replace(/\s/g, '');
    if (known_candidates.indexOf(candidate_id) === -1 && candidate_id.match(/\d\d/)) {
      // new candidate with valid ID
      known_candidates.push(candidate_id);
    } else {
      // repeat (consensus_forms come first, so this could be an old entry copy)
      $(candidates[c]).remove();
    }
  }

  var house = $($("select")[0]).attr("value");
  $($("option[value='" + house + "']")[0]).prop('selected', true);

  // sort unique candidates alphabetically
  var sortCandidates = function() {
    candidates = myanmarNameSort($("tr"), function(candidate) {
      return $(candidate).find('td.name').text();
    });
    $("table#candidates").html(candidates);
  };

  candidates = $("tr");
  $("span.total").text(candidates.length - 1);
  sortCandidates();

  var verifyButtonRespond = function(e) {
    var candidate = $(e.currentTarget).parents("tr")[0];
    if ($(e.currentTarget).text() === "Verify") {
      $(e.currentTarget)
        .text("Remove?")
        .css({ backgroundColor: "#004", color: "#fff" });
    } else {
      $(e.currentTarget)
        .text("Verify")
        .css({ backgroundColor: "#4a4", color: "#000" });
    }
    updateVerifyCount();
  };

  $(".verify button").click(verifyButtonRespond);

  updateVerifyCount = function() {
    var verifyCount = 0;
    $(".verify button").each(function(i, btn) {
      if ($(btn).text() !== "Verify") {
        verifyCount++;
      }
    });
    $("span.verified").text(verifyCount);
  };

  updateVerifyCount();

  $.getJSON("/constituencies.json", function (constituencies) {
    /*
    $.each(constituencies, function (i, constituency) {
      $("#conname").append($("<option value='" + constituency + "'>" + constituency + "</option>"));
    });
    var selectcon = $($("select")[1]).attr("value");
    $($("option[value='" + selectcon + "']")[0]).prop('selected', true);
    */
    ac = new AutoComplete('conname', {
      lists: [ constituencies.concat([]) ],
      maxTokenGroups: 1
    });
    $("#conname input").on("blur", function (e) {
      $("form button").attr("disabled", true);
      setTimeout(function() {
        $("#connamehold").val( ac.getValue()[0][0].value );
        $("form button").attr("disabled", false);
      }, 300);
    });
    $("form button").on("click", function (e) {
      $("#connamehold").val( ac.getValue()[0][0].value );
    });
  });

  var insertRows = function (results) {
    for (var r = 0; r < results.length; r++) {
      var tr = $("<tr>");
      tr.append($("<td class='source'></td>").text(results[r].source));
      tr.append($("<td class='dbid'></td>").text(results[r].id));
      tr.append($("<td class='constituency_number'></td>").text(results[r].constituency_number));
      tr.append($("<td class='norm_id'></td>").text(results[r].norm_national_id));
      tr.append($("<td class='name'></td>").append($("<a target='_blank'></a>").text(results[r].full_name).attr("href", "/form/" + results[r].form_id)));
      tr.append($("<td class='natid'></td>").text(results[r].national_id));
      tr.append($("<td class='party'></td>").text(results[r].party));
      tr.append($("<td class='address'></td>").text(results[r].constituency_name));

      if (results[r].house) {
        tr.append($("<td class='house'></td>").text(results[r].house));
      } else {
        tr.append($('<td class="house"><select><option value="အမျိုးသားလွှတ်တော်">အမျိုးသားလွှတ်တော်</option><option value="ပြည်သူ့လွှတ်တော်">ပြည်သူ့လွှတ်တော်</option><option value="တိုင်းဒေသကြီး/ပြည်နယ် လွှတ်တော်">တိုင်းဒေသကြီး/ပြည်နယ် လွှတ်တော်</option></select></td>'));
      }
      if (results[r].verified) {
        tr.append($("<td class='verify'><button class='verified'>Verified</button></td>").text(results[r].address));
      } else {
        tr.append($("<td class='verify'><button>Verify</button></td>").text(results[r].address));
      }

      $("table").append(tr);
    }
  };

  $("button.findname").click(function() {
    $("button.findname").attr("disabled", true);
    $.getJSON("/candidatename/" + $("input.findname").val() + "?format=json", function (results) {
      $("button.findname").attr("disabled", false);

      insertRows(results);

      // sortCandidates();
      $(".verify button").off("click").click(verifyButtonRespond);
    });
  });

  $("button.findmore").click(function() {
    $("button.findmore").attr("disabled", true);
    $.getJSON("/candidate/" + $("input.findmore").val().replace("/", "*") + "?format=json", function (results) {
      $("button.findmore").attr("disabled", false);

      insertRows(results);

      // sortCandidates();
      $(".verify button").off("click").click(verifyButtonRespond);
    });
  });

  $("button.done").click(function() {
    // update verified and unverified candidates
    var verified = [];
    var unverified = [];
    var amended = [];
    $("tr").each(function (i, tr) {
      if (i === 0) {
        return;
      }
      var candidate = $(tr);
      var normid = candidate.find(".norm_id").text();
      var buttontext = candidate.find("button").text();
      if (buttontext === "Verify") {
        unverified.push(normid);
      } else if (buttontext.indexOf("Remove") > -1) {
        verified.push(normid);
        if (($("#old_con_number").val() && $("#old_con_number").val() != candidate.find('.constituency_number').text()) || ($("#old_con_name").val() && candidate.find('.constituency').text().indexOf($("#old_con_name").val()) === -1)) {
          amended.push({
            id: candidate.find(".norm_id").text(),
            constituency_name: $("#old_con_name").val(),
            constituency_number: $("#old_con_number").val() * 1 || candidate.find('.constituency_number').text()
          });
        }
      }
    });

    // update houses if it was missing
    var houses = {
      "အမျိုးသားလွှတ်တော်": [],
      "ပြည်သူ့လွှတ်တော်": [],
      "တိုင်းဒေသကြီး/ပြည်နယ် လွှတ်တော်": []
    };
    $("select").each(function (i, select) {
      if (i < 2) {
        return;
      }
      var candidate = $(select).parents("tr");
      var normid = candidate.find(".norm_id").text();
      houses[$(select).val()].push(normid);
    });

    $.post("/verified", {
      verified: verified,
      unverified: unverified,
      houses: houses,
      amended: amended
    }, function (response) {
      console.log(response);
      if (response.err) {
        alert("LOG IN - it didn't work");
      } else {
        window.location.href = "/verify";
      }
    });
  });
});
