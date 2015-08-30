$(function () {
  // filter down to candidates with unique IDs
  // prefer consensus_forms
  var known_candidates = [];
  var candidates = $("tr");
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

  // sort unique candidates alphabetically
  candidates = myanmarNameSort($("tr"), function(candidate) {
    return $(candidate).find('td.name').text();
  });
  $("table#candidates").html(candidates);
  $("span.total").text(candidates.length);

  $(".verify button").click(function (e) {
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
  });

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

  $("button.done").click(function() {
    // update verified and unverified candidates
    var verified = [];
    var unverified = [];
    $("tr").each(function (i, tr) {
      if (i === 0) {
        return;
      }
      var candidate = $(tr);
      var normid = candidate.find(".norm_id").text();
      if (candidate.find("button").text() === "Verify") {
        unverified.push(normid);
      } else {
        verified.push(normid);
      }
    });

    // update houses if it was missing
    var houses = {
      "အမျိုးသားလွှတ်တော်": [],
      "ပြည်သူ့လွှတ်တော်": [],
      "တိုင်းဒေသကြီး/ပြည်နယ် လွှတ်တော်": []
    };
    $("select").each(function (i, select) {
      var candidate = $(select).parents("tr");
      var normid = candidate.find(".norm_id").text();
      houses[$(select).val()].push(normid);
    });
    console.log(houses);

    $.post("/verified", { verified: verified, unverified: unverified, houses: houses }, function (response) {
      console.log(response);
      if (response.err) {
        alert("LOG IN - it didn't work");
      } else {
        window.location.href = "/verify";
      }
    });
  });
});
