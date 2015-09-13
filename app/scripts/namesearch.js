$(".namesearch button").click(function () {
  var searchname = $(".namesearch input").val();
  $.getJSON("/name?search=" + searchname, function (data) {
    $(".namesearch input").val(data.fuzzname.replace(/%/g, ''));
    $("table#names").html('');
    console.log(data.people);
    for (var p = 0; p < data.people.length; p++) {
      var person = data.people[p];
      $("table#names").append($("<tr>")
        .append( $("<td class='name'></td>").text(person.full_name) )
        .append( $("<td></td>").text(person.full_name) )
        .append( $("<td class='con_name'></td>").text(person.constituency_name) )
        .append( $("<td></td>").text(person.constituency_number) )
        .append( $("<td></td>").text(person.party) )
      );
    }
    sortNames();
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
