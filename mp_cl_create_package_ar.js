/*
 * Module Description
 * 
 * Author: Ankith Ravindran
 *
 * NSVersion  Date                    Last Modified time                  
 * 1.00       2017-08-14 15:43:31     2017-08-14 15:43:31           
 *
 * Remarks: Client script for the create / edit packages
 *
 */
var services_selected = new Array();

var comm_reg_results;
var serviceSearch;

var baseURL = 'https://1048144.app.netsuite.com';
if (nlapiGetContext().getEnvironment() == "SANDBOX") {
  baseURL = 'https://system.sandbox.netsuite.com';
}

$(window).load(function() {
  // Animate loader off screen
  $(".se-pre-con").fadeOut("slow");;
});

var old_packages = [];
var nsItemName = [];
var nsItemID = [];



/**
 * [pageInit description] - On page initialization, 
 */
function pageInit() {

  $('#alert').hide();

  $(function() {
    $('[data-toggle="tooltip"]').tooltip()
  })

  AddStyle('https://1048144.app.netsuite.com/core/media/media.nl?id=1988776&c=1048144&h=58352d0b4544df20b40f&_xt=.css', 'head');
  $('.services_selected_class').selectator({
    keepOpen: true,
    showAllOptionsOnFocus: true,
    selectFirstOptionOnSearch: false
  });

  var main_table = document.getElementsByClassName("uir-outside-fields-table");

  for (var i = 0; i < main_table.length; i++) {
    main_table[i].style.width = "100%";
  }

  var customer_id = parseInt(nlapiGetFieldValue('custpage_customer_id'));

  var searched_packages = nlapiLoadSearch('customrecord_service_package', 'customsearch_smc_packages');

  var fil_line = [];
  fil_line[fil_line.length] = new nlobjSearchFilter('custrecord_service_package_customer', null, 'is', customer_id);


  searched_packages.addFilters(fil_line);
  var packageResult = searched_packages.runSearch();

  var count = 0;
  var old_package_id;


  packageResult.forEachResult(function(searchPackageResult) {

    var package_id = searchPackageResult.getValue('internalid');
    var service_id = searchPackageResult.getValue('internalid', 'CUSTRECORD_SERVICE_PACKAGE');

    if (old_packages[package_id] == undefined) {
      old_packages[package_id] = [];
      old_packages[package_id][0] = service_id;
    } else {
      var size = old_packages[package_id].length;
      old_packages[package_id][size] = service_id;
    }


    count++;
    return true;
  });
}

var app = angular.module('myApp', []);
app.controller('myCtrl', function($scope) {
  // $scope.showSelectValue = function(serviceSelected) {
  //   var result = getNSItem(serviceSelected);
  //    $(event.target).parent().parent().find('.nsItemName').val(result[1]);

  // }
});

/** 
 * [getNSItem description] - To get the NS Item Name for packages using the se: Package - NetSuite Items based on the services selected.
 * @param  {array} servicesArray [description]
 */
function getNSItem(servicesArray, package_type) {

  console.log('package_type' + package_type);

  if (isNullorEmpty(package_type)) {
    var packageType = 'No';
  } else if (package_type == 'NeoPost') {
    var packageType = 'Yes';
  }

  // var serviceTypesArray = [];
  // for (var i = 0; i < servicesArray.length; i++) {
  //   serviceTypesArray[i] = nlapiLookupField('customrecord_service', servicesArray[i], 'name');
  // }

  // var nsItemSearch = nlapiLoadSearch('item', 'customsearch_mod_package_ns_items');

  // var newFilters = new Array();
  // if (!isNullorEmpty(serviceTypesArray)) {
  //   // newFilters[newFilters.length] = new nlobjSearchFilter('custitem_service_types', null, 'allof', serviceTypesArray);
  //   // 
  //   newFilters = [
  //     [
  //       ["formulatext: {custitem_service_types}", "is", serviceTypesArray.toString()], "AND", "NOT", ["custitem_service_types", "anyof", "@NONE@"]
  //     ],
  //     "OR", ["name", "is", "Fixed Charges"]
  //   ]
  // }

  var serviceTypesArray = [];
  for (var i = 0; i < servicesArray.length; i++) {
    serviceTypesArray[i] = nlapiLookupField('customrecord_service', servicesArray[i], 'custrecord_service_classification', true);
  }

  serviceTypesArray = serviceTypesArray.filter(function(elem, index, self) {
    return index === self.indexOf(elem);
  });

  serviceTypesArray.sort();

  var nsItemSearch = nlapiLoadSearch('item', 'customsearch_mod_package_ns_items');

  var newFilters = new Array();
  if (!isNullorEmpty(serviceTypesArray)) {
    // newFilters[newFilters.length] = new nlobjSearchFilter('custitem_service_types', null, 'allof', serviceTypesArray);
    // 
    newFilters = [
      [
        ["formulatext: {custitem_service_classification}", "is", serviceTypesArray.toString()], "AND", "NOT", ["custitem_service_classification", "anyof", "@NONE@"]
      ],
      "OR", ["name", "is", "Fixed Charges"]
    ];


    nsItemSearch.setFilterExpression(newFilters);
  }
  
  var NPfilter = new Array();
  NPfilter[0] = new nlobjSearchFilter('formulatext', null, 'is', packageType); // or No
  NPfilter[0].setFormula("DECODE(SUBSTR({name},1,7),'Neopost','Yes','No')");

  nsItemSearch.addFilters(NPfilter);

  var resultSet = nsItemSearch.runSearch();

  nsItemName = [];
  nsItemID = [];

  var i = 0;
  resultSet.forEachResult(function(searchResult) {

    var type = searchResult.getValue('formulatext');

    if (packageType == type) {
      nsItemID[i] = searchResult.getValue('internalid');
      nsItemName[i] = searchResult.getValue('itemid');
      i++;
    }


    return true;
  });

  console.log('i value' + i);

  if (i == 0) {
    nsItemName = [];
    nsItemID = [];
  }
}

/**
 * [description] - To preview the package on the invoice
 */
$(document).on('click', '.preview_row', function(event) {

  var el = $(this).closest('tr').find('.services_selected_class');
  var single_line = $(this).closest('tr').find('.single_line_class').val();
  var total = $(this).closest('tr').find('.total_class').val();
  var discount = $(this).closest('tr').find('.discount_class').val();
  var period_type = $(this).closest('tr').find('.period_type_class').val();
  var nsItem = $(this).closest('tr').find('.nsItemName').find('option:selected').text();

  var preview_html = '';

  var gst_value = 0.1;
  var total_gst = 1.1;

  preview_html = '<div style=\"background-color: #cfeefc !important;border: 1px solid #417ed9;padding: 10px 10px 10px 20px;width:100%;\"><b><u>IMPORTANT INSTRUCTIONS:</u></b><ul><li>Assuming 20 working days in a month</li></ul></div><br/><br/><br/><table class="table table-responsive table-striped"><thead><tr class="info"><th><b>ITEM</b></th><th><b>QTY</b></th><th><b>RATE</b><small style="color: black;">(Exc GST)</small></th><th style="text-align: right;"><b>TOTAL</b><small style="color: black;">(Exc GST)</small></th><th style="text-align: right;"><b>GST</b></th><th style="text-align: right;"><b>GROSS TOTAL</b></th></thead><tbody>'

  el.find('option:selected').each(function() {

    var service_id = $(this).val();
    var price = $(this).data('price');

    if (single_line == 2) {
      var service_record = nlapiLoadRecord('customrecord_service', service_id);

      var item_id = service_record.getFieldValue('custrecord_service_ns_item');

      var item_name = nlapiLookupField('item', item_id, 'itemid');

      preview_html += '<tr><td>' + item_name + '</td><td>20</td><td style="text-align: right;">$' + price + '</td><td style="text-align: right;">$' + parseFloat(price * 20).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(price * 20 * gst_value).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(price * 20 * total_gst).toFixed(2) + '</td></tr>';
    }
  });

  console.log('period type ' + period_type);
  if (period_type != 3) {
    if (single_line == 2) {
      preview_html += '<tr><td>Discount</td><td>20</td><td style="text-align: right;">$' + discount + '</td><td style="text-align: right;">$' + parseFloat(discount * 20).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(discount * 20 * gst_value).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(discount * 20 * total_gst).toFixed(2) + '</td></tr></tbody></table>';
    } else {

      if (nsItem == ' ') {
        preview_html += '<tr><td>Fixed Charges</td><td>20</td><td>$' + total + '</td><td style="text-align: right;">$' + parseFloat(total * 20).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(total * 20 * gst_value).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(total * 20 * total_gst).toFixed(2) + '</td></tr></tbody></table>';
      } else {
        preview_html += '<tr><td>' + nsItem + '</td><td>20</td><td>$' + total + '</td><td style="text-align: right;">$' + parseFloat(total * 20).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(total * 20 * gst_value).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(total * 20 * total_gst).toFixed(2) + '</td></tr></tbody></table>';
      }
    }
  } else {
    if (nsItem == ' ') {
      preview_html += '<tr><td>Fixed Charges</td><td>1</td><td>$' + total + '</td><td style="text-align: right;">$' + parseFloat(total).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(total * gst_value).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(total * total_gst).toFixed(2) + '</td></tr></tbody></table>';
    } else {
      preview_html += '<tr><td>' + nsItem + '</td><td>1</td><td>$' + total + '</td><td style="text-align: right;">$' + parseFloat(total).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(total * gst_value).toFixed(2) + '</td><td style="text-align: right;">$' + parseFloat(total * total_gst).toFixed(2) + '</td></tr></tbody></table>';
    }
  }


  $('.modal .modal-header').html('<div class="form-group"><h4><label class="control-label" for="inputError1">Invoice Preview!!</label></h4></div>');
  $('.modal .modal-body').html("");
  $('.modal .modal-body').html(preview_html);
  $('.modal').modal("show");


});

$(document).on('click', '#alert .close', function(e) {
  $(this).parent().hide();
});

function showAlert(message) {
  $('#alert').html('<button type="button" class="close">&times;</button>' + message);
  $('#alert').show();
}

$(document).on('click', '#alert .close', function(e) {
  $(this).parent().hide();
});



$('#exampleModal').on('show.bs.modal', function(event) {
  var button = $(event).relatedTarget // Button that triggered the modal
  var recipient = button.data('whatever') // Extract info from data-* attributes
  // If necessary, you could initiate an AJAX request here (and then do the updating in a callback).
  // Update the modal's content. We'll use jQuery here, but you could use a data binding library or other methods instead.
  var modal = $(this)
  modal.find('.modal-title').text('New message to ' + recipient)
  modal.find('.modal-body input').val(recipient)
});

$(document).ready(function() {
  $(".modal_display").click(function() {
    var link = $(this).data("whatever");
    $('.modal .modal-header').html('<div class="form-group"><h4><label class="control-label" for="inputError1">Information!!</label></h4></div>');
    $('.modal .modal-body').html("");
    $('.modal .modal-body').html(link);
    $('.modal').modal("show");


  });
});


/**
 * [description] - On click of the Add button
 */
$(document).on('click', '.add_class', function(event) {

  var serviceSearch = nlapiLoadSearch('customrecord_service', 'customsearch_smc_services');

  var newFilters_service = new Array();
  newFilters_service[newFilters_service.length] = new nlobjSearchFilter('custrecord_service_customer', null, 'is', parseInt(nlapiGetFieldValue('custpage_customer_id')));

  serviceSearch.addFilters(newFilters_service);

  var resultSet_service = serviceSearch.runSearch();

  var serviceResult = resultSet_service.getResults(0, 1);

  var package_name = $(this).closest('tr').find('.package_name_class').val();
  var date_effective = $(this).closest('tr').find('.date_effective').val();
  var extras_included = $(this).closest('tr').find('.extras_included_class').val();
  var package_type = $(this).closest('tr').find('.package_type_class').val();
  var discount_type = $(this).closest('tr').find('.discount_type').val();
  var single_line = $(this).closest('tr').find('.single_line_class').val();
  var invoice_incomplete = $(this).closest('tr').find('.invoice_incomplete_class').val();
  var period_type = $(this).closest('tr').find('.period_type_class').val();
  var total = $(this).closest('tr').find('.total_class').val();
  var discount = $(this).closest('tr').find('.discount_class').val();

  var el = $(this).closest('tr').find('.services_selected_class');



  if (isNullorEmpty(package_name)) {
    // alert('Please enter Package Name');
    showAlert('Please enter Package Name');

    $(this).closest('tr').find('.package_name_class').focus();
    return false;
  }
  if (isNullorEmpty(date_effective)) {
    // alert('Please enter Package Name');
    showAlert('Please enter Date Effective from');

    $(this).closest('tr').find('.date_effective').focus();
    return false;
  }

  if (el.find('option:selected').length == 0) {
    showAlert('Please Select one or more Services');

    $(this).closest('tr').find('.services_selected_class').focus();
    return false;
  }


  if (single_line == 0) {
    showAlert('Please Select the Invoice as Single Line Item');

    $(this).closest('tr').find('.single_line_class').focus();
    return false;
  }

  if (period_type == 0) {
    showAlert('Please Select the Period Type');
    $(this).closest('tr').find('.period_type_class').focus();
    return false;
  }

  if (invoice_incomplete == 0) {
    showAlert('Please Select the Invoice If Incomplete');
    $(this).closest('tr').find('.period_type_class').focus();
    return false;
  }

  // if(fixed_rate == 0){
  //   showAlert('Please Select the Fixed Rate');
  //   $(this).closest('tr').find('.period_type_class').focus();
  //   return false;
  // } else if(fixed_rate == 1){
  //   if(!isNullorEmpty(discount) || discount > 0){
  //     showAlert('Discount needs to be zero if fixed rate is selected as YES');
  //     return false;
  //   }
  // } else if(fixed_rate == 2){
  //    if(isNullorEmpty(discount) || discount ==0){
  //     showAlert('Discount cannot be zero if fixed rate is selected as NO');
  //     return false;
  //   }
  // }  


  if (extras_included == 0) {
    showAlert('Please Select if Extras Included or Not');
    $(this).closest('tr').find('.period_type_class').focus();
    return false;
  }

  if (total == 0) {
    showAlert('Total cannot be 0 or Empty');
    $(this).closest('tr').find('.period_type_class').focus();
    return false;
  }


  // $("#customer").each(function () {
  //     var tds = '<tr>';
  //     var count_cols = 0;
  //     jQuery.each($('tr:last td', this), function () {
  //        if(count_cols == 0){
  //         tds += '<td class="first_col">' + $(this).html() + '</td>';
  //        } else {
  //          tds += '<td>' + $(this).html() + '</td>';
  //        }
  //        count_cols++;
  //     });
  //     tds += '</tr>';
  //     if ($('tbody', this).length > 0) {
  //         $('tbody', this).append(tds);
  //     } else {
  //         $(this).append(tds);
  //     }
  // });

  var row_count = $('#customer tr').length;

  row_count++;

  var inlineQty = '<tr><td class="first_col"><button class="btn btn-success btn-sm add_class glyphicon glyphicon-plus" type="button" data-toggle="tooltip" data-placement="right" title="Add New Package"></button><input type="hidden" class="delete_package" value="F" /></td><td><div class="package_name_div"><input class="form-control package_name_class"  name="package_name[' + row_count + ']" type="text"/></div></td><td><input type="date" class="form-control date_effective" style="width: 155px" value="' + firstDayofMonth() + '"></td><td><select class="form-control package_type_class" name="package_type[' + row_count + ']" type="text" ><option value="1">NeoPost</option><option value="' + null + '" selected></option></select></td><td class="col-xs-2"><div class="services_div"><select multiple class="form-control services_selected_class" name="services_selected[' + row_count + ']">';
  if (serviceResult.length != 0) {
    resultSet_service.forEachResult(function(searchResult_service) {
      if (searchResult_service.getValue('custrecord_service') != 17) {
        inlineQty += '<option data-price="' + searchResult_service.getValue('custrecord_service_price') + '" value="' + searchResult_service.getValue('internalid') + '" data-right="$' + searchResult_service.getValue('custrecord_service_price') + '" data-subtitle="' + searchResult_service.getValue('custrecord_service_description') + '">' + searchResult_service.getText('custrecord_service') + '</option>';
      }
      return true;
    });
  } //
  inlineQty += '</select></div></td><td><div class="period_type_div"><select class="form-control period_type_class" name="period_type[' + row_count + ']" required><option value="0"></option><option value="1">per Visit</option><option value="2">per Day</option><option value="3">Monthly</option></select></div></td><td><div class="single_line_div"><select class="form-control single_line_class" name="single_line[' + row_count + ']" required ><option value="0"></option><option value="1">Yes</option><option value="2">No</option></select></div></td>';
  inlineQty += '<td><div class="invoice_incomplete_div"><select class="form-control invoice_incomplete_class" name="invoice_incomplete[' + row_count + ']" type="text" ><option value="0"></option><option value="1">Yes</option><option value="2">No</option></div></select></td>';
  inlineQty += '<td><div class="extras_included_div"><select class="form-control extras_included_class" name="extras_included[' + row_count + ']" type="text" ><option value="0"></option><option value="1">Yes</option><option value="2">No</option></div></select></td><td style="display: none;"><div class="input-group discount_dollar has-error"><input type="hidden" class="discount_type" value="1" /><div class="input-group-addon">$</div>';
  // inlineQty += '<select class="form-control discount_type input-group-addon"><option value="1">$</option><option value="2">%</option></select>';
  inlineQty += '<input class="form-control discount_class" step="any" name="discount[' + row_count + ']" type="number" pattern="^\d*(\.\d{2}$)?" min="0" disabled /></div></td><td><div class="input-group has-success"><div class="input-group-addon">$</div><input class="form-control total_class" name="total[' + row_count + ']" step="any" pattern="^\d*(\.\d{2}$)?" type="number" /></div><span id="helpBlock" class="help-block hidden">Monthly</span></td><td><select disabled class="form-control nsItemName"><option></option></select></td></tr>';

  $('#customer tr:last').after(inlineQty);

  $('.services_selected_class').selectator({
    keepOpen: true,
    showAllOptionsOnFocus: true,
    selectFirstOptionOnSearch: false
  });

  $(this).toggleClass('btn-warning btn-success')
  $(this).toggleClass('glyphicon-pencil glyphicon-plus');
  $(this).toggleClass('edit_class add_class');
  $(this).find('edit_class').prop('title', 'Edit Package');
  $(this).closest('tr').find('.package_name_class').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.date_effective').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.services_selected_class').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.chosen-container').toggleClass('chosen-disabled');
  // $(this).closest('tr').find('.fixed_rate_class').prop('disabled', function(i, v) { return !v; });
  if (period_type != 3) {
    $(this).closest('tr').find('.invoice_incomplete_class').prop('disabled', function(i, v) {
      return !v;
    });
    $(this).closest('tr').find('.single_line_class').prop('disabled', function(i, v) {
      return !v;
    });
  }

  $(this).closest('tr').find('.discount_type').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.period_type_class').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.package_type_class').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.extras_included_class').prop('disabled', function(i, v) {
    return !v;
  });
  if (discount_type == 2) {
    $(this).closest('tr').find('.discount_class').prop('disabled', function(i, v) {
      return !v;
    });
  } else if (discount_type == 1) {
    $(this).closest('tr').find('.total_class').prop('disabled', function(i, v) {
      return !v;
    });
  }

  if (single_line == 1) {
    $(this).closest('tr').find('.nsItemName').prop('disabled', function(i, v) {
      return !v;
    });
  }

  $(this).closest('tr').find('.first_col').append('<button class="btn btn-danger btn-sm remove_class glyphicon glyphicon-trash" type="button" data-toggle="tooltip" data-placement="right" title="Delete"></button><br><button class="btn btn-primary btn-sm preview_row glyphicon glyphicon-new-window" type="button" data-toggle="tooltip" data-placement="right" title="Preview Invoice"></button>');

  $(function() {
    $('[data-toggle="tooltip"]').tooltip()
  })

});

/**
 * [description] - On the click of the edit button
 */
$(document).on('click', '.edit_class', function(event) {

  var package_name = $(this).closest('tr').find('.package_name_class').val();
  var date_effective = $(this).closest('tr').find('.date_effective').val();
  var extras_included = $(this).closest('tr').find('.extras_included_class').val();
  var package_type = $(this).closest('tr').find('.package_type_class').val();
  var discount_type = $(this).closest('tr').find('.discount_type').val();
  var single_line = $(this).closest('tr').find('.single_line_class').val();
  var invoice_incomplete = $(this).closest('tr').find('.invoice_incomplete_class').val();
  var period_type = $(this).closest('tr').find('.period_type_class').val();
  var discount_value = $(this).closest('tr').find('.services_selected_class').val();
  var discount = $(this).closest('tr').find('.discount_class').val();

  var el = $(this).closest('tr').find('.services_selected_class');


  // if (isNullorEmpty(package_name)) {
  //   showAlert('Please enter Package Name');
  //   $(this).closest('tr').find('.package_name_class').focus();
  //   return false;
  // }

  // if (isNullorEmpty(date_effective)) {
  //   showAlert('Please enter Date Effective From');
  //   $(this).closest('tr').find('.date_effective').focus();
  //   return false;
  // }

  // if (el.find('option:selected').length < 1) {
  //   showAlert('Please Select one or more Services');
  //   $(this).closest('tr').find('.services_selected_class').focus();
  //   return false;
  // }

  // if (invoice_incomplete == 0) {
  //   showAlert('Please Select the Invoice If Incomplete');
  //   $(this).closest('tr').find('.period_type_class').focus();
  //   return false;
  // }

  // // if(fixed_rate == 0){
  // //   showAlert('Please Select the Fixed Rate');
  // //   $(this).closest('tr').find('.period_type_class').focus();
  // //   return false;
  // // } else if(fixed_rate == 1){
  // //   if(!isNullorEmpty(discount) || discount > 0){
  // //     showAlert('Discount needs to be zero if fixed rate is selected as YES');
  // //     return false;
  // //   }
  // // } else if(fixed_rate == 2){
  // //    if(isNullorEmpty(discount) || discount ==0){
  // //     showAlert('Discount cannot be zero if fixed rate is selected as NO');
  // //     return false;
  // //   }
  // // }  

  // if (single_line == 0) {
  //   showAlert('Please Select the Invoice as Single Line Item');
  //   $(this).closest('tr').find('.single_line_class').focus();
  //   return false;
  // }


  // if (period_type == 0) {
  //   showAlert('Please Select the Period Type');
  //   $(this).closest('tr').find('.period_type_class').focus();
  //   return false;
  // }

  // if (extras_included == 0) {
  //   showAlert('Please Select if Extras Included or Not');
  //   $(this).closest('tr').find('.period_type_class').focus();
  //   return false;
  // }

  $(this).toggleClass('btn-warning btn-success')
  $(this).toggleClass('glyphicon-pencil glyphicon-ok');
  $(this).closest('tr').find('.package_name_class').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.date_effective').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.services_selected_class').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.chosen-container').toggleClass('chosen-disabled');
  // $(this).closest('tr').find('.fixed_rate_class').prop('disabled', function(i, v) { return !v; });

  if (period_type != 3) {
    $(this).closest('tr').find('.invoice_incomplete_class').prop('disabled', function(i, v) {
      return !v;
    });
    $(this).closest('tr').find('.single_line_class').prop('disabled', function(i, v) {
      return !v;
    });
  }
  // $(this).closest('tr').find('.invoice_incomplete_class').prop('disabled', function(i, v) { return !v; });
  $(this).closest('tr').find('.period_type_class').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.package_type_class').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.extras_included_class').prop('disabled', function(i, v) {
    return !v;
  });
  $(this).closest('tr').find('.discount_type').prop('disabled', function(i, v) {
    return !v;
  });
  if (discount_type == 2) {
    $(this).closest('tr').find('.discount_class').prop('disabled', function(i, v) {
      return !v;
    });
  } else if (discount_type == 1) {
    $(this).closest('tr').find('.total_class').prop('disabled', function(i, v) {
      return !v;
    });
  }

  if (single_line == 1) {
    $(this).closest('tr').find('.nsItemName').prop('disabled', function(i, v) {
      return !v;
    });
  }


});

/**
 * [description] - On click of the delete button
 */
$(document).on('click', '.remove_class', function(event) {

  if (confirm('Are you sure you want to delete this item?\n\nThis action cannot be undone.')) {

    $(this).closest('tr').find('.delete_package').val("T");
    $(this).closest("tr").hide();
  }



});

/**
 * [description] - on select of the discount period type
 */
$(document).on('change', '.period_type_class', function(e) {

  /**
   * Description - If monthly is selected, the invopice if incomplete, invoice single line is set to yes and disbaled.
   */
  if ($('option:selected', this).val() == 3) {
    var el = $(this).closest('tr').find('.services_selected_class');
    var package_type_class = $(this).closest('tr').find('.package_type_class');
    var servicesSelected = [];
    var package_type;
    el.find('option:selected').each(function() {
      servicesSelected[servicesSelected.length] = $(this).val();
    });
    package_type_class.find('option:selected').each(function() {
      package_type = $(this).text();
    });
    if (!isNullorEmpty(servicesSelected)) {
      getNSItem(servicesSelected, package_type);
    }

    var htmlText = ''
    if (isNullorEmpty(nsItemName) || isNullorEmpty(nsItemID)) {
      $(this).closest('tr').find('.nsItemName').empty();
    } else {
      $(this).closest('tr').find('.nsItemName').empty();
      $(this).closest('tr').find('.nsItemName').append($('<option></option>').val('0').html(' '));
      for (var i = 0; i < nsItemID.length; i++) {
        $(this).closest('tr').find('.nsItemName').append(
          $('<option></option>').val(nsItemID[i]).html(nsItemName[i])
        );
      }

    }
    $(this).closest('tr').find('.total_class').removeAttr("disabled");
    $(this).closest('tr').find('.discount_class').attr("disabled", "disabled");
    // $(this).closest('tr').find('.fixed_rate_class').attr("disabled", "disabled");
    $(this).closest('tr').find('.discount_class').val("");
    // $(this).closest('tr').find('.fixed_rate_class').val(1);
    $(this).closest('tr').find('.invoice_incomplete_class').val(1);
    $(this).closest('tr').find('.single_line_class').val(1);
    $(this).closest('tr').find('.invoice_incomplete_class').attr("disabled", "disabled");
    $(this).closest('tr').find('.single_line_class').attr("disabled", "disabled");
    $(this).closest('tr').find('.nsItemName').removeAttr("disabled");
    // $(this).closest('tr').find('#helpBlock').removeClass('hidden');
  } else {
    $(this).closest('tr').find('.invoice_incomplete_class').val(0);
    $(this).closest('tr').find('.invoice_incomplete_class').removeAttr("disabled");
    $(this).closest('tr').find('.single_line_class').val(0);
    $(this).closest('tr').find('.single_line_class').removeAttr("disabled");
    $(this).closest('tr').find('.nsItemName').val(0);
    $(this).closest('tr').find('.nsItemName').attr("disabled", "disabled");

    var total_service_selected = 0;

    var el = $(this).closest('tr').find('.services_selected_class');
    var discount_value = $(this).closest('tr').find('.discount_class').val();
    var total_value = $(this).closest('tr').find('.total_class').val();

    el.find('option:selected').each(function() {
      total_service_selected = total_service_selected + parseFloat($(this).data('price'));

    });
    var total = total_value - total_service_selected;
    if (total < 0) {
      $(this).closest('tr').find('.discount_dollar').addClass('has-error');
      $(this).closest('tr').find('.discount_dollar').removeClass('has-success');
      $(this).closest('tr').find('.discount_class').val(total);
    } else {
      $(this).closest('tr').find('.discount_class').val("");
      $(this).closest('tr').find('.total_class').val(total_service_selected);
      return false;
    }

  }

});

/** [description] - On change of Invoice As Single Line Item, the NetSuite item is disbaled/enabled */
$(document).on('change', '.single_line_class', function(e) {

  if ($('option:selected', this).val() == 1) {
    var el = $(this).closest('tr').find('.services_selected_class');
    var package_type_class = $(this).closest('tr').find('.package_type_class');
    var servicesSelected = [];
    var package_type;
    el.find('option:selected').each(function() {
      servicesSelected[servicesSelected.length] = $(this).val();
    });
    package_type_class.find('option:selected').each(function() {
      package_type = $(this).text();
    });
    getNSItem(servicesSelected, package_type);
    if (isNullorEmpty(nsItemName) || isNullorEmpty(nsItemID)) {
      $(this).closest('tr').find('.nsItemName').empty();
    } else {
      $(this).closest('tr').find('.nsItemName').empty();
      $(this).closest('tr').find('.nsItemName').append($('<option></option>').val('0').html(' '));
      for (var i = 0; i < nsItemID.length; i++) {
        $(this).closest('tr').find('.nsItemName').append(
          $('<option></option>').val(nsItemID[i]).html(nsItemName[i])
        );
      }

    }
    $(this).closest('tr').find('.nsItemName').removeAttr("disabled");
  } else {
    $(this).closest('tr').find('.nsItemName').attr("disabled", "disabled")
  }
});

/**
 * [description] - If the package type is selected
 */
$(document).on('change', '.package_type_class', function(e) {

  /**
   * Description - if NeoPost is selected, by default invoice incomplete, single line is set to yes and extras included is set to NO and discount period is set to monthly.
   */
  if ($('option:selected', this).val() == 1) {

    var el = $(this).closest('tr').find('.services_selected_class');
    var servicesSelected = [];
    el.find('option:selected').each(function() {
      servicesSelected[servicesSelected.length] = $(this).val();
    });
    if (!isNullorEmpty(servicesSelected)) {
      getNSItem(servicesSelected, 'NeoPost');
    }

    $(this).closest('tr').find('.period_type_class').val(3);
    $(this).closest('tr').find('.invoice_incomplete_class').val(1);
    $(this).closest('tr').find('.invoice_incomplete_class').attr("disabled", "disabled");
    $(this).closest('tr').find('.single_line_class').val(1);
    $(this).closest('tr').find('.single_line_class').attr("disabled", "disabled");
    $(this).closest('tr').find('.extras_included_class').val(2);
    $(this).closest('tr').find('.nsItemName').removeAttr("disabled");
  } else {
    $(this).closest('tr').find('.period_type_class').val(0);
    $(this).closest('tr').find('.invoice_incomplete_class').val(0);
    $(this).closest('tr').find('.invoice_incomplete_class').removeAttr("disabled");
    $(this).closest('tr').find('.single_line_class').val(0);
    $(this).closest('tr').find('.single_line_class').removeAttr("disabled");
    $(this).closest('tr').find('.extras_included_class').val(0);
    $(this).closest('tr').find('.nsItemName').attr("disabled", "disabled")
    $(this).closest('tr').find('.nsItemName').val('');
  }

});


/**
 * [description] - On select of the discount type.
 */
$(document).on('change', '.discount_type', function(e) {

  if ($('option:selected', this).val() == 1) {
    $(this).closest('tr').find('.total_class').removeAttr("disabled");
    $(this).closest('tr').find('.discount_class').attr("disabled", "disabled");
    $(this).closest('tr').find('.discount_class').val("");
  } else {
    $(this).closest('tr').find('.total_class').attr("disabled", "disabled");
    $(this).closest('tr').find('.discount_class').removeAttr("disabled");
  }

});

$(document).on("focus", ".services_selected_class", function(e) {
  // console.log('alert');
  $(this).closest('tr').find('.selectator_element').removeClass("options-hidden");
});


/**
 * [description] - On services selected, calculate the totla of the services selected and fill in the total field
 */
$(document).on("change", ".services_selected_class", function(e) {
  var total = 0;
  var discount_value = $(this).closest('tr').find('.discount_class').val();
  var package_type_class = $(this).closest('tr').find('.package_type_class');
  package_type_class.find('option:selected').each(function() {
    package_type = $(this).text();
  });
  if ($('option:selected', this).length >= 1) {

    if ($(this).closest('tr').find('.single_line_class').val() == 1) {
      getNSItem($(this).val(), package_type);
      var htmlText = ''
      if (isNullorEmpty(nsItemName) || isNullorEmpty(nsItemID)) {
        $(this).closest('tr').find('.nsItemName').empty();
      } else {
        $(this).closest('tr').find('.nsItemName').empty();
        $(this).closest('tr').find('.nsItemName').append($('<option></option>').val('0').html(' '));
        for (var i = 0; i < nsItemID.length; i++) {
          $(this).closest('tr').find('.nsItemName').append(
            $('<option></option>').val(nsItemID[i]).html(nsItemName[i])
          );
        }

      }

    }


    $('option:selected', this).each(function() {
      total = total + parseFloat($(this).data('price'));

    });
    if (discount_value != 0 && !isNullorEmpty(discount_value)) {
      total = total - discount_value;
    }
    $(this).closest('tr').find('.total_class').val(total);
    if ($(this).closest('tr').find('.fixed_rate_class').val() != 1) {
      // $(this).closest('tr').find('.discount_class').removeAttr("disabled");
    }
  } else {
    $(this).closest('tr').find('.nsItemName').empty()
    $(this).closest('tr').find('.total_class').val(total);
    showAlert('Please select one or more Services to create a package');

    return false;
  }
});


$(document).on('blur', '.discount_class', function() {
  // var total = $(this).closest('tr').find('.total_class').val();
  var total = 0;
  var el = $(this).closest('tr').find('.services_selected_class');

  el.find('option:selected').each(function() {
    total = total + parseFloat($(this).data('price'));
  });

  // console.log(total);

  var discount_type = $(this).closest('tr').find('.discount_type').val();

  var discount = $(this).val();

  if (discount == 0) {
    showAlert('Discount value cannot be 0');
    return false;
  }


  if (parseFloat(discount) >= parseFloat(total) && discount_type == 1) {
    $(this).closest('tr').find('.discount_class').val("");
    showAlert('Discount should be less than the total value of all the services selected');
    return false;
  } else if (discount_type == 2 && discount > 100) {
    showAlert('Discount applied is out of range');
    return false;
  }

  var discounted_total = 0;
  if (discount_type == 1) {
    discounted_total = parseFloat(total) - parseFloat(discount);
  } else {
    discounted_total = parseFloat(total) - ((parseFloat(discount) / 100) * parseFloat(total));
  }


  $(this).closest('tr').find('.total_class').val(discounted_total);
});


/**
 * [description] - On change of the total field, the discount needs to be calculated and filled.
 */
$(document).on('blur', '.total_class', function() {
  var total = 0;
  var el = $(this).closest('tr').find('.services_selected_class');

  el.find('option:selected').each(function() {
    total = total + parseFloat($(this).data('price'));
  });

  var discount_type = $(this).closest('tr').find('.discount_type').val();
  var period_type = $(this).closest('tr').find('.period_type_class').val();

  var total_value = $(this).val();

  if (total_value == 0) {
    showAlert('Total value cannot be 0');
    return false;
  }

  if ((period_type == 1 || period_type == 2 || period_type == 0) && parseFloat(total_value) > parseFloat(total)) {
    $(this).closest('tr').find('.discount_class').val("");
    $(this).val(total);
    alert('Total should be less than the total value of all the services selected.\nPlease update the price of the services.');
    return false;
  }

  if ((period_type == 1 || period_type == 2) && discount_type == 1) {
    discounted_total = parseFloat(total_value) - parseFloat(total);
    if (discounted_total < 0) {
      $(this).closest('tr').find('.discount_dollar').addClass('has-error');
      $(this).closest('tr').find('.discount_dollar').removeClass('has-success');
    } else {
      $(this).closest('tr').find('.discount_dollar').addClass('has-success');
      $(this).closest('tr').find('.discount_dollar').removeClass('has-error');
    }
    if (discounted_total < 0) {
      $(this).closest('tr').find('.discount_class').val(parseFloat(discounted_total));
    }
    $(this).closest('tr').find('.discount_class').val(parseFloat(discounted_total));
  }



});

/**
 * [onclick_back description] - Go back to the Item pricing Review Page
 */
function onclick_back() {


  var params = {
    custid: parseInt(nlapiGetFieldValue('custpage_customer_id')),
  }
  params = JSON.stringify(params);

  var url = baseURL + nlapiResolveURL('suitelet', nlapiGetFieldValue('suitlet'), nlapiGetFieldValue('deployid')) + '&unlayered=T&custparam_params=' + nlapiGetFieldValue('entry_string');
  window.open(url, "_self", "height=500,width=800,modal=yes,alwaysRaised=yes");
}


/**
 * [updatePackages description] - Create / Update the packages.
 */
function updatePackages() {

  var delete_package_elem = document.getElementsByClassName("delete_package");
  var package_name_elem = document.getElementsByClassName("package_name_class");
  var date_effective_elem = document.getElementsByClassName("date_effective");
  var services_selected_elem = document.getElementsByClassName("services_selected_class");
  var single_line_elem = document.getElementsByClassName("single_line_class");
  var extras_included_elem = document.getElementsByClassName("extras_included_class");
  var fixed_rate_elem = document.getElementsByClassName("fixed_rate_class");
  var invoice_incomplete_elem = document.getElementsByClassName("invoice_incomplete_class");
  var period_type_elem = document.getElementsByClassName("period_type_class");
  var discount_type_elem = document.getElementsByClassName("discount_type");
  var discount_elem = document.getElementsByClassName("discount_class");
  var total_elem = document.getElementsByClassName("total_class");
  var package_type_elem = document.getElementsByClassName("package_type_class");
  var nsItemName_elem = document.getElementsByClassName("nsItemName");
  var delete_package = [];
  var package_names = [];
  var date_effective = [];
  var package_texts = [];
  var services_selected = [];
  var old_package_name = [];
  var single_line = [];
  var extras_included = [];
  var fixed_rate = [];
  var period_type = [];
  var package_type = [];
  var nsItemName = [];
  var nsItemID = [];
  var nsItemPrice = [];
  var invoice_incomplete = [];
  var discount_type = [];
  var discount = [];
  var total = [];

  for (var i = 0; i < delete_package_elem.length; ++i) {
    if (typeof delete_package_elem[i].value !== "undefined") {
      delete_package.push(delete_package_elem[i].value);
    }
    var test = package_name_elem[i].value;
    test = test.toLowerCase().replace(/ /g, '-');
    if (!isNullorEmpty(package_name_elem[i].value) && jQuery.inArray(test, old_package_name) > -1 && delete_package[i] == "F" && !isNullorEmpty(old_package_name)) {
      showAlert('Package Names cannot be duplicated');
      return false;
    } else if (typeof package_name_elem[i].value !== "undefined") {
      var test = package_name_elem[i].value;
      test = test.toLowerCase().replace(/ /g, '-');
      if (!package_name_elem[i].hasAttribute("data-service")) {
        package_names.push(package_name_elem[i].value);
        package_texts.push(package_name_elem[i].value);
      } else {
        package_names.push(package_name_elem[i].getAttribute('data-service'));
        package_texts.push(package_name_elem[i].value);
      }
    }
    old_package_name.push(test);
    if (typeof single_line_elem[i].value !== "undefined") {
      single_line.push(single_line_elem[i].value);
    }
    if (typeof date_effective_elem[i].value !== "undefined") {
      date_effective.push(date_effective_elem[i].value);
    }
    services_selected[i] = [];
    var z = 0;
    if (typeof services_selected_elem[i].value !== "undefined") {
      // console.log(services_selected_elem[i].options.length);

      for (var y = 0, len = services_selected_elem[i].options.length; y < len; y++) {
        opt = services_selected_elem[i].options[y];

        if (opt.selected === true) {
          services_selected[i][z] = services_selected_elem[i].options[y].value;
          z++;
        }
      }
      if (z == 0 && delete_package[i] == "F" && !isNullorEmpty(package_name_elem[i].value)) {
        showAlert('Please Select one or more Services');
        return false;
      }
    }
    if (typeof package_type_elem[i].value !== "undefined") {
      package_type.push(package_type_elem[i].value);
    }
    if (typeof nsItemName_elem[i].value !== "undefined") {
      nsItemName.push(nsItemName_elem[i].value);
    }
    if (typeof extras_included_elem[i].value !== "undefined") {
      extras_included.push(extras_included_elem[i].value);
    }
    if (typeof invoice_incomplete_elem[i].value !== "undefined") {
      invoice_incomplete.push(invoice_incomplete_elem[i].value);
    }
    if (typeof period_type_elem[i].value !== "undefined") {
      period_type.push(period_type_elem[i].value);
    }
    if (typeof discount_type_elem[i].value !== "undefined") {
      discount_type.push(discount_type_elem[i].value);
    }
    if (typeof discount_elem[i].value !== "undefined") {
      discount.push(discount_elem[i].value);
    }
    if (typeof total_elem[i].value !== "undefined") {
      total.push(total_elem[i].value);
    }
  }

  console.log(date_effective);

  /**
   * [for description] - For each row of packages, the for loop runs
   */
  for (var x = 0; x < package_names.length; x++) {
    /**
     * Description - If the package is removed, the package is set to Inactive
     */
    if (delete_package[x] == "T") {
      if (isNaN(package_names[x]) == false) {
        for (var y = 0; y < old_packages[package_names[x]].length; y++) {
          var service_record = nlapiLoadRecord('customrecord_service', old_packages[package_names[x]][y]);

          var service_package = service_record.getFieldValues('custrecord_service_package');

          var index = service_package.indexOf(package_names[x]);

          if (index > -1 && isNaN(service_package) == true) {
            service_package.splice(index, 1);
          } else {
            service_package = null;
          }

          service_record.setFieldValues('custrecord_service_package', service_package);

          nlapiSubmitRecord(service_record);

        }

        var searched_jobs = nlapiLoadSearch('customrecord_job', 'customsearch_smc_jobs_packaged');

        var newFilters = new Array();
        newFilters[0] = new nlobjSearchFilter('custrecord_job_customer', null, 'is', parseInt(nlapiGetFieldValue('custpage_customer_id')));
        newFilters[1] = new nlobjSearchFilter('custrecord_job_service_package', null, 'is', package_names[x]);

        searched_jobs.addFilters(newFilters);

        var resultSet = searched_jobs.runSearch();

        var packageResult = resultSet.getResults(0, 1);

        if (!isNullorEmpty(packageResult)) {
          var package_record = nlapiLoadRecord('customrecord_service_package', package_names[x]);

          package_record.setFieldValue('isinactive', 'T');

          nlapiSubmitRecord(package_record);

        } else {
          nlapiDeleteRecord('customrecord_service_package', package_names[x]);
        }
      }
    } else {
      if (!isNullorEmpty(package_names[x])) {


        /**
         * Description - Validation
         */
        if (services_selected[x].length == 0) {
          showAlert('Please Select Services');
          return false;
        }
        if (single_line[x] == 0) {
          showAlert('Please Select Invoice as Single Line Item');
          return false;
        }

        if (invoice_incomplete[x] == 0) {
          showAlert('Please Select Invoice if Incomplete');
          return false;
        }
        if (period_type[x] == 0) {
          showAlert('Please Select the Period Type');
          return false;
        }

        if (isNullorEmpty(total[x]) || total[x] == 0) {
          showAlert('Total cannot be empty or zero');
          return false;
        }

        /**
         * Description - if th package ID is not present, the package record is created
         */
        if (isNaN(package_names[x]) == true) {
          var package_record = nlapiCreateRecord('customrecord_service_package', {
            recordmode: 'dynamic'
          });
        } else {
          /**
           * package is loaded
           */
          var package_record = nlapiLoadRecord('customrecord_service_package', package_names[x]);
        }

        package_record.setFieldValue('name', package_name_elem[x].value);
        var splitDate = date_effective[x].split('-');
        var dateEffective = splitDate[2] + '/' + splitDate[1] + '/' + splitDate[0];
        package_record.setFieldValue('custrecord_service_package_date_effectiv', dateEffective);
        package_record.setFieldValue('custrecord_service_package_customer', parseInt(nlapiGetFieldValue('custpage_customer_id')));
        package_record.setFieldValue('custrecord_service_package_comm_reg', nlapiGetFieldValue('custpage_customer_comm_reg'));
        package_record.setFieldValue('custrecord_service_package_disc_period', period_type[x]);
        package_record.setFieldValue('custrecord_service_package_type', package_type[x]);

        package_record.setFieldValue('custrecord_service_package_inv_one_line', single_line[x]);
        package_record.setFieldValue('custrecord_service_package_inv_incomplet', invoice_incomplete[x]);
        package_record.setFieldValue('custrecord_service_package_disc_type', discount_type[x]);
        package_record.setFieldValue('custrecord_service_package_extra_inc', extras_included[x]);
        package_record.setFieldValue('custrecord_service_package_fix_mth_rate', total[x]);
        if (nsItemName[x] != 0) {
          package_record.setFieldValue('custrecord_service_package_ns_item', nsItemName[x]);
          nsItemID[nsItemID.length] = nsItemName[x];
          nsItemPrice[nsItemPrice.length] = total[x];
        }
        package_record.setFieldValue('custrecord_service_package_disc_value', null);

        var saved_package_id = nlapiSubmitRecord(package_record);

        /**
         * Description - Assign the packages to the Service records as well
         */
        if (isNaN(package_names[x]) == true) {
          for (var y = 0; y < services_selected[x].length; y++) {
            var service_record = nlapiLoadRecord('customrecord_service', services_selected[x][y]);

            var service_package_field = (service_record.getFieldValue('custrecord_service_package'));

            if (isNullorEmpty(service_package_field)) {
              var ids = saved_package_id;
              service_record.setFieldValue('custrecord_service_package', ids);
            } else {
              service_package_field = String(service_package_field);
              service_package_field = service_package_field.split(',');
              if (jQuery.inArray(saved_package_id, service_package_field) == -1) {
                service_package_field.push(saved_package_id);
                for (var i = 0; i < service_package_field.length; i++) {
                  service_package_field[i] = parseInt(service_package_field[i]);
                }
                // console.log(service_package_field);
                service_record.setFieldValues('custrecord_service_package', service_package_field);
              }
            }

            nlapiSubmitRecord(service_record);

          }
        } else {
          if (old_packages[package_names[x]] != undefined) {
            for (var y = 0; y < services_selected[x].length; y++) {
              var service_package_index = old_packages[package_names[x]].indexOf(services_selected[x][y]);
              if (service_package_index == -1) {
                var service_record = nlapiLoadRecord('customrecord_service', services_selected[x][y]);

                var service_package_field = (service_record.getFieldValue('custrecord_service_package'));

                if (isNullorEmpty(service_package_field)) {
                  var ids = saved_package_id;
                  service_record.setFieldValue('custrecord_service_package', ids);
                } else {
                  service_package_field = String(service_package_field);
                  service_package_field = service_package_field.split(',');
                  if (jQuery.inArray(saved_package_id, service_package_field) == -1) {
                    service_package_field.push(saved_package_id);
                    for (var i = 0; i < service_package_field.length; i++) {
                      service_package_field[i] = parseInt(service_package_field[i]);
                    }
                    // console.log(service_package_field);
                    service_record.setFieldValues('custrecord_service_package', service_package_field);
                  }
                }

                nlapiSubmitRecord(service_record);
              } else {

                if (isNaN(old_packages[package_names[x]]) == true) {
                  old_packages[package_names[x]].splice(service_package_index, 1);
                } else {
                  old_packages[package_names[x]] = [];
                }

              }
            }
            if (!isNullorEmpty(old_packages[package_names[x]])) {
              for (var t = 0; t < old_packages[package_names[x]].length; t++) {
                var service_record = nlapiLoadRecord('customrecord_service', old_packages[package_names[x]][t]);

                var service_package = service_record.getFieldValues('custrecord_service_package');

                var index = service_package.indexOf(package_names[x]);

                if (index > -1 && isNaN(service_package) == true) {
                  service_package.splice(index, 1);
                } else {
                  service_package = null;
                }

                service_record.setFieldValues('custrecord_service_package', service_package);

                nlapiSubmitRecord(service_record);
              }
            }
          }
        }
      } else {
        if (services_selected[x].length > 0) {
          showAlert('Please Enter Package Name');
          return false;
        }
        if (single_line[x] > 0) {
          showAlert('Please Enter Package Name');
          return false;
        }
        if (fixed_rate[x] > 0) {
          showAlert('Please Enter Package Name');
          return false;
        }
        if (period_type[x] > 0) {
          showAlert('Please Enter Package Name');
          return false;
        }
      }
    }
  }

  // var recCustomer = nlapiLoadRecord('customer', parseInt(nlapiGetFieldValue('custpage_customer_id')));
  // var initial_size_of_financial = recCustomer.getLineItemCount('itempricing');
  // for (var i = 0; i < nsItemID.length; i++) {
  //   initial_size_of_financial++;
  //   recCustomer.setLineItemValue('itempricing', 'item', initial_size_of_financial, nsItemID[i]);
  //   recCustomer.setLineItemValue('itempricing', 'level', initial_size_of_financial, -1);
  //   recCustomer.setLineItemValue('itempricing', 'price', initial_size_of_financial, nsItemPrice[i]);

  // }

  // nlapiSubmitRecord(recCustomer);

  nlapiSetFieldValue('nsitem', nsItemID.toString());
  nlapiSetFieldValue('nsitemprice', nsItemPrice.toString());

  return true;
}

function saveRecord() {

  var return_value = updatePackages();

  if (return_value == true) {
    if (nlapiGetFieldValue('suitlet') == 'customscript_sl_smc_main') {
      var upload_url = baseURL + nlapiResolveURL('SUITELET', 'customscript_sl_smc_summary', 'customdeploy_sl_smc_summary');
      window.open(upload_url, "_self", "height=750,width=650,modal=yes,alwaysRaised=yes");
    } else if (nlapiGetFieldValue('suitlet') == 'customscript_sl_salesbtns_finalise') {
      return true;
    }

  }

}

function AddJavascript(jsname, pos) {
  var tag = document.getElementsByTagName(pos)[0];
  var addScript = document.createElement('script');
  addScript.setAttribute('type', 'text/javascript');
  addScript.setAttribute('src', jsname);
  tag.appendChild(addScript);
}

function AddStyle(cssLink, pos) {
  var tag = document.getElementsByTagName(pos)[0];
  var addLink = document.createElement('link');
  addLink.setAttribute('type', 'text/css');
  addLink.setAttribute('rel', 'stylesheet');
  addLink.setAttribute('href', cssLink);
  tag.appendChild(addLink);
}

function GetFormattedDate(stringDate) {

  var todayDate = nlapiStringToDate(stringDate);
  var month = pad(todayDate.getMonth() + 1);
  var day = pad(todayDate.getDate());
  var year = (todayDate.getFullYear());
  return year + "-" + month + "-" + day;
}

function pad(s) {
  return (s < 10) ? '0' + s : s;
}

function firstDayofMonth() {

  var date = new Date();

  var month = date.getMonth(); //Months 0 - 11
  var day = date.getDate();
  var year = date.getFullYear();

  var firstDay = new Date(year, (month), 1);
  // var lastDay = new Date(year, (month + 1), 0);

  return GetFormattedDate(nlapiDateToString(firstDay));
}