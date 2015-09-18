$(".namesearch button").click(function () {
  var searchname = $(".namesearch input.name").val();
  var constituency = $(".namesearch input.con_name").val();
  $.getJSON("/name?search=" + searchname + "&constituency=" + constituency, function (data) {
    $(".namesearch input.name").val(data.fuzzname.replace(/%/g, ''));
    $("table#candidates").html('');
    console.log(data.people);
    for (var p = 0; p < data.people.length; p++) {
      var person = data.people[p];
      $("table#candidates").append($("<tr>")
        .append( $("<td class='verify'><button>Approve</button></td>") )
        .append( $("<td class='name'>" + person.full_name + "</td>") )
        .append( $("<td></td>").text(person.full_name) )
        .append( $("<td class='con_name'></td>").text(person.constituency_name) )
        .append( $("<td></td>").text(person.constituency_number) )
        .append( $("<td></td>").text(person.party) )
        .append( $("<td class='norm_id natid'></td>").text(person.norm_national_id) )
        .append( $("<td class='norm_id source'></td>").text(person.source) )
        .append( $("<td class='norm_id id'></td>").text(person.id) )
      );
    }
    sortNames();
    powerButtons();
  });
});

function sortNames() {
  if ($("table#candidates tr").length) {
    $("table#candidates").html(myanmarNameSort($("table#candidates tr"), function (row) {
      return $(row).find('.name').text() + $(row).find('.con_name').text();
    }));
  }
}
sortNames();

function powerButtons() {
  $("td.verify button").click(function (e) {
    var row = $(e.currentTarget).parents("tr");
    $.post('/name', {
      candidate: $(".candidate_id").text(),
      house: $(".candidate .house").text(),
      id: row.find('.id').text(),
      norm_id: row.find('.natid').text(),
      source: row.find('.source').text()
    }, function (data) {
      //console.log(data);
      window.location.href = "/name";
    });
  });
}

powerButtons();
