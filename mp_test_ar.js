/*
 * Module Description
 * 
 * Author: Ankith Ravindran
 *
 * NSVersion  Date                      Last Modified time                      
 * 1.00       2017-08-10 14:11:49       2017-08-10 14:11:49           
 *
 * Remarks:Page to create / edit packages
 *
 */

var baseURL = 'https://1048144.app.netsuite.com';
if (nlapiGetContext().getEnvironment() == "SANDBOX") {
    baseURL = 'https://system.sandbox.netsuite.com';
}

var serviceIDs = [];
var nsItemName = [];
var nsItemID = [];

function getNSItem(servicesArray, package_type) {

    if (isNullorEmpty(package_type)) {
        var packageType = 'No';
    } else if (package_type == 'NeoPost') {
        var packageType = 'Yes';
    }

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
    }

    nsItemSearch.setFilterExpression(newFilters);

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

    if (i == 0) {
        nsItemName = [];
        nsItemID = [];
    }
}


function main(request, response) {

    if (request.getMethod() == "GET") {

        var row_count = 0;

        var packages_array = [];

        var script_id = null;
        var deploy_id = null;
        var entryParamsString = null;

        if (isNullorEmpty(request.getParameter('custid'))) {
            var params = request.getParameter('params');

            entryParamsString = params;
            params = JSON.parse(params);
            var customer = params.custid;
            script_id = params.id;
            deploy_id = params.deploy;

        } else {
            var customer = request.getParameter('custid');
        }


        var recCustomer = nlapiLoadRecord('customer', customer);
        var franchisee = recCustomer.getFieldValue('partner');

        var form = nlapiCreateForm('Create Package: <a href="' + baseURL + '/app/common/entity/custjob.nl?id=' + customer + '">' + recCustomer.getFieldValue('entityid') + '</a> ' + recCustomer.getFieldValue('companyname'));

        form.addField('suitlet', 'text', 'suitlet_id').setDisplayType('hidden').setDefaultValue(script_id);
        form.addField('deployid', 'text', 'deploy_id').setDisplayType('hidden').setDefaultValue(deploy_id);
        form.addField('entry_string', 'textarea', 'Latitude').setDisplayType('hidden').setDefaultValue(entryParamsString);
        form.addField('nsitem', 'text', 'NS Item').setDisplayType('hidden');
        form.addField('nsitemprice', 'text', 'NS Item').setDisplayType('hidden');


        var commReg_search = nlapiLoadSearch('customrecord_commencement_register', 'customsearch_service_commreg_assign');

        var filterExpression = [
            ["custrecord_customer", "anyof", customer], // customer id
            "AND", ["custrecord_franchisee", "is", franchisee] // partner id
        ];

        commReg_search.setFilterExpression(filterExpression);

        var comm_reg_results = commReg_search.runSearch();

        var count_commReg = 0;
        var commReg = null;

        comm_reg_results.forEachResult(function(searchResult) {
            count_commReg++;

            /**
             * [if description] - Only the latest comm Reg needs to be assigned
             */
            if (count_commReg == 1) {
                commReg = searchResult.getValue('internalid');
            }

            /**
             * [if description] - if more than one Comm Reg, error mail is sent
             */
            if (count_commReg > 1) {
                return false;
            }
            return true;
        });

        // var comm_reg_results = commRegSearch(customer);

        form.addTab('custom_new_pricing', 'New Services');

        /**
         * Description - To get all the services associated with this customer
         */
        var serviceSearch = nlapiLoadSearch('customrecord_service', 'customsearch_smc_services');

        var newFilters_service = new Array();
        newFilters_service[newFilters_service.length] = new nlobjSearchFilter('custrecord_service_customer', null, 'is', customer);

        serviceSearch.addFilters(newFilters_service);

        var resultSet_service = serviceSearch.runSearch();

        var serviceResult = resultSet_service.getResults(0, 1);


        /**
         * Description - To get all the packaged associated with this customer
         */
        var packageSearch = nlapiLoadSearch('customrecord_service_package', 'customsearch_smc_packages');

        var newFilters_package = new Array();
        newFilters_package[newFilters_package.length] = new nlobjSearchFilter('custrecord_service_package_customer', null, 'is', customer);

        packageSearch.addFilters(newFilters_package);

        var resultSet_package = packageSearch.runSearch();

        var packageResult = resultSet_package.getResults(0, 1);

        // var serviceSearch = serviceFuncSearch(customer, comm_reg_results);

        // var packageSearch = packageFuncSearch(customer, comm_reg_results);

        form.addField('custpage_customer_id', 'text', 'Customer ID').setDisplayType('hidden').setDefaultValue(customer);
        form.addField('custpage_customer_franchisee', 'text', 'Franchisee ID').setDisplayType('hidden').setDefaultValue(nlapiLookupField('customer', customer, 'partner'));
        if (!isNullorEmpty(commReg)) {
            form.addField('custpage_customer_comm_reg', 'text', 'Comm Reg ID').setDisplayType('hidden').setDefaultValue(commReg);
        }

        /**
         * Description - To add all the API's to the begining of the page
         */
        var inlineQty = '<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"><script src="//code.jquery.com/jquery-1.11.0.min.js"></script><link type="text/css" rel="stylesheet" href="https://cdn.datatables.net/1.10.13/css/jquery.dataTables.min.css"><link href="//netdna.bootstrapcdn.com/bootstrap/3.3.2/css/bootstrap.min.css" rel="stylesheet"><script src="//netdna.bootstrapcdn.com/bootstrap/3.3.2/js/bootstrap.min.js"></script><link rel="stylesheet" href="https://1048144.app.netsuite.com/core/media/media.nl?id=2060796&c=1048144&h=9ee6accfd476c9cae718&_xt=.css"/><script src="https://1048144.app.netsuite.com/core/media/media.nl?id=2060797&c=1048144&h=ef2cda20731d146b5e98&_xt=.js"></script><link type="text/css" rel="stylesheet" href="https://1048144.app.netsuite.com/core/media/media.nl?id=2090583&c=1048144&h=a0ef6ac4e28f91203dfe&_xt=.css"><script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.6.4/angular.min.js"></script>';

        var fils = new Array();
        fils[fils.length] = new nlobjSearchFilter('entity', null, 'is', customer);
        fils[fils.length] = new nlobjSearchFilter('mainline', null, 'is', true);
        fils[fils.length] = new nlobjSearchFilter('memorized', null, 'is', false);
        fils[fils.length] = new nlobjSearchFilter('custbody_inv_type', null, 'is', '@NONE@');
        fils[fils.length] = new nlobjSearchFilter('trandate', null, 'onorafter', null, 'threeMonthsAgo');
        fils[fils.length] = new nlobjSearchFilter('voided', null, 'is', false);

        var cols = new Array();
        cols[cols.length] = new nlobjSearchColumn('internalid');
        cols[cols.length] = new nlobjSearchColumn('tranid');
        cols[cols.length] = new nlobjSearchColumn('total');
        cols[cols.length] = new nlobjSearchColumn('trandate').setSort(true);
        cols[cols.length] = new nlobjSearchColumn('status');

        var inv_results = nlapiSearchRecord('invoice', null, fils, cols);

        if (!isNullorEmpty(inv_results)) {

            inlineQty += '<br><br><style>table#customer_invoice {font-size:12px; text-align:center; border-color: #24385b}</style><table border="0" cellpadding="15" id="customer_invoice" class="table table-responsive table-striped customer tablesorter" cellspacing="0" style="width: 100%;"><thead style="color: white;background-color: #607799;"><tr><th colspan="5" style="vertical-align: middle;text-align: center;"><b>LAST 3 MONTHS INVOICES</b></th></tr><tr class="text-center">';

            /**
             * INVOICE DATE
             */
            inlineQty += '<th style="vertical-align: middle;text-align: center;"><b>INVOICE DATE</b></th>';
            /**
             * INVOICE NO.
             */
            inlineQty += '<th style="vertical-align: middle;text-align: center;"><b>INVOICE NO.</b></th>';
            /**
             * INVOICE TOTAL
             */
            inlineQty += '<th style="vertical-align: middle;text-align: center;" ><b>INVOICE TOTAL</b></th>';

            /**
             * INVOICE STATUS
             */
            inlineQty += '<th style="vertical-align: middle;text-align: center;"><b>STATUS</b></th></tr></thead><tbody>';



            for (var x = 0; x < inv_results.length; x++) {
                inlineQty += '<tr>';
                inlineQty += '<td>' + inv_results[x].getValue('trandate') + '</td>';
                inlineQty += '<td><a href="' + baseURL + '/app/accounting/transactions/custinvc.nl?id=' + inv_results[x].getValue('internalid') + '" target="_blank">' + inv_results[x].getValue('tranid') + '</a></td>';
                inlineQty += '<td>' + inv_results[x].getValue('total') + '</td>';
                inlineQty += '<td>' + inv_results[x].getText('status') + '</td>';
                inlineQty += '</tr>';
            }

            inlineQty += '</tbody></table><br/>';
        }



        /**
         * Description - To create the table and colums assiocted with the page.
         */
        inlineQty += '<br><br><style>table#customer {font-size:12px; text-align:center; border-color: #24385b}</style><form id="package_form" class="form-horizontal"><div class="form-group container-fluid"><div><div id="alert" class="alert alert-danger fade in"></div><div class="modal fade bs-example-modal-sm" tabindex="-1" role="dialog" aria-labelledby="mySmallModalLabel" aria-hidden="true"><div class="modal-dialog modal-sm" role="document"><div class="modal-content" style="width: max-content;"><div class="modal-header"><button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button><h4 class="modal-title panel panel-info" id="exampleModalLabel">Information</h4><br> </div><div class="modal-body"></div><div class="modal-footer"><button type="button" class="btn btn-default" data-dismiss="modal">Close</button></div></div></div></div><div ng-app="myApp" ng-controller="myCtrl"><table border="0" cellpadding="15" id="customer" class="table table-responsive table-striped customer tablesorter" cellspacing="0" style="width: 100%;"><thead style="color: white;background-color: #607799;"><tr><th colspan="5" style="background-color: white;"></th><th colspan="4" style="vertical-align: middle;text-align: center;"><b>CRITERIA</b></th><th colspan="3" style="background-color: white;"></th></tr><tr class="text-center">';
        /**
         * ACTION ROW
         */
        inlineQty += '<th style="vertical-align: middle;text-align: center;"><b>ACTION</b></th>';
        /**
         * PACKAGE NAME ROW
         */
        inlineQty += '<th style="vertical-align: middle;text-align: center;" class="col-xs-1"><b>PACKAGE NAME<span class="modal_display glyphicon glyphicon-info-sign" style="padding: 3px 3px 3px 3px;color: orange;cursor: pointer;" data-whatever="Type the Name for Package. <br><br>This Name is solely for internal use and will not be displayed on customer invoices."></span></b><br/><small style="color: white;">(Internal Use)</small></th>';
        /**
         * DATE EFFECTIVE FROM
         */

        inlineQty += '<th style="vertical-align: middle;text-align: center;" class=""><b>DATE EFFECTIVE FROM<span class="modal_display glyphicon glyphicon-info-sign" style="padding: 3px 3px 3px 3px;color: orange;cursor: pointer;" data-whatever=""></span></b></th>';
        /**
         * PACKAGE TYPE ROW
         */
        inlineQty += '<th style="vertical-align: middle;text-align: center;"><b>PACKAGE TYPE <span class="modal_display btn-sm glyphicon glyphicon-info-sign" style="cursor: pointer;padding: 3px 3px 3px 3px;color: orange;" data-whatever="Choose the relevant Type of Package.<br><br>Differentiates the type of Package being created. (eg. Neopost)"></span></b></th>';
        /**
         * SERVICES ROW
         */
        inlineQty += '<th style="vertical-align: middle;text-align: center;" class="col-xs-2"><b>SERVICE(S)<span class="modal_display btn-sm glyphicon glyphicon-info-sign" style="cursor: pointer;padding: 3px 3px 3px 3px;color: orange;" data-whatever="Select the relevant Service(s) for the Package.<br><br>Selected Service(s) will be allocated to the relevant Package and invoiced at the Package price if the criteria set-out on the subsequent fields are met."></span></b></th>';

        /**
         * PERIOD TYPE ROW
         */
        inlineQty += '<th style="vertical-align: middle;text-align: center;" class="col-sm-1"><b>PERIOD TYPE<span class="modal_display btn-sm glyphicon glyphicon-info-sign" style="color: orange;padding: 3px 3px 3px 3px;cursor: pointer;" data-whatever="Select the Period Type for the Package.<br><br>This specifies the day, time and/or location the selected Service(s) will be required to be performed to qualify for the Package price and/or discount.<br><br><b>per Visit</b> - performed at the same visit (location and time)<br><b>per Day</b> - performed in the same day (regardless of location/time)<br><b>Monthly</b> - performed in the same billing month (regardless of day/location/time)"></span></b></th>';
        /**
         * INVOICE AS SINGLE LINE ITEM ROW
         */
        inlineQty += '<th style="vertical-align: middle;text-align: center;" class="col-xs-1"><b>INVOICE AS SINGLE LINE ITEM<span class="modal_display btn-sm glyphicon glyphicon-info-sign" style="color: orange;padding: 3px 3px 3px 3px;cursor: pointer;" data-whatever="Select <b><u>Yes</u></b> to Invoice the selected Service(s) as a single Invoice Line Item. (ie. part of a package).<br><br>Otherwise, select <b><u>No</u></b> to have selected Service(s) appear as individual Invoice Line Items on the Invoice. (ie. not part of a package)"></span></b></th>';
        /**
         * INVOICE IF INCOMPLETE ROW
         */
        inlineQty += '<th style="vertical-align: middle;text-align: center;" class="col-xs-1"><b>INVOICE IF INCOMPLETE<span class="modal_display btn-sm glyphicon glyphicon-info-sign" style="cursor: pointer;color: orange;padding: 3px 3px 3px 3px;" data-whatever="<b><u>Yes</u></b> Jobs including those unsuccessfully performed/Incompleted will be packaged for invoicing. <br><b><u>No</u></b> Only Jobs successfully performed/Completed will be packaged for invoicing. <br>Unattempted jobs will not be considered for any packages."></span></b></th>';
        /**
         * EXTRAS INCLUDED ROW
         */
        inlineQty += '<th style="vertical-align: middle;text-align: center;" class="col-xs-1"><b>EXTRAS INCLUDED<span class="modal_display btn-sm glyphicon glyphicon-info-sign" style="cursor: pointer;color: orange;padding: 3px 3px 3px 3px;" data-whatever="Specifies that Package price includes all Standard Extra charges. (ie. Parcel Collection, Registered Mail, Weight Charges)<br><br>Select <b><u>Yes</u></b> if Standard Extras are included in the Package price.<br>Select <b><u>No</u></b> to separately charge for Standard Extra charges as incurred in addition to the Package price."></span></b></th>';
        /**
         * DISCOUNT ROW
         */
        inlineQty += '<th style="display: none;vertical-align: middle;text-align: center;width: 110px;" class="" ><b>DISCOUNT<span class="modal_display btn-sm glyphicon glyphicon-info-sign" style="color: orange;padding: 3px 3px 3px 3px;cursor: pointer;" data-whatever=""></span></b></th>';
        /**
         * TOTAL ROW
         */
        inlineQty += '<th style="vertical-align: middle;text-align: center;width: 125px;"><b>PRICE<span class="modal_display btn-sm glyphicon glyphicon-info-sign" style="color: orange;padding: 3px 3px 3px 3px;cursor: pointer;" data-whatever="The total for the package."></span></b><br/><small style="color: white;">(Exc GST)</small></th>';

        /** 
         * NetSuite Items Row
         */
        inlineQty += '<th style="vertical-align: middle;text-align: center;" class=""><b>NETSUITE ITEM<span class="modal_display btn-sm glyphicon glyphicon-info-sign" style="cursor: pointer;padding: 3px 3px 3px 3px;color: orange;" data-whatever=""></span></b></th></tr></thead><tbody>';

        var old_package_id = null;


        /**
         * Descirption - To check if there are packages associated with this customer, if yes preload all the packages with their corresponding information.
         */
        if (packageResult.length != 0) {
            resultSet_package.forEachResult(function(searchResult_package) {

                var date_effective = searchResult_package.getValue('custrecord_service_package_date_effectiv');

                var start_date = null;

                if (!isNullorEmpty(date_effective)) {
                    start_date = GetFormattedDate(date_effective);
                }

                var dateEffective = date_effective.split('/');

                // nlapiLogExecution('DEBUG', 'dateEffective', dateEffective);

                date_effective = dateEffective[2] + '-' + dateEffective[1] + '-' + dateEffective[0];

                // nlapiLogExecution('DEBUG', 'start_date', start_date);

                var total_per_package = 0.0;
                serviceIDs = [];

                if (old_package_id != searchResult_package.getValue('internalid')) {
                    inlineQty += '<tr><td class="first_col"><button class="btn btn-warning btn-sm edit_class glyphicon glyphicon-pencil" type="button" data-toggle="tooltip" data-placement="right" title="Edit"></button><br/><button class="btn btn-danger btn-sm remove_class glyphicon glyphicon-trash" type="button" data-toggle="tooltip" data-placement="right" title="Delete"></button><br><button class="btn btn-primary btn-sm preview_row glyphicon glyphicon-new-window" type="button" data-toggle="tooltip" data-placement="right" title="Preview Invoice"></button><input type="hidden" class="delete_package" value="F" /></td><td><input class="form-control package_name_class" disabled name="package_name[' + row_count + ']" type="text" data-service="' + searchResult_package.getValue('internalid') + '" value="' + searchResult_package.getValue('name') + '" /></td><td><input type="date" style="width: 155px" class="date_effective form-control" value="' + start_date + '" disabled /></td><td><select disabled class="form-control package_type_class" name="package_type[' + row_count + ']" type="text" >';

                    /**
                     * Description - To get the Package Type value from the package record
                     */
                    var packageType = '';
                    if (searchResult_package.getValue('custrecord_service_package_type') == 1) {
                        inlineQty += '<option value="1" selected>NeoPost</option><option value="' + null + '"></option>';
                        packageType = 'NeoPost';
                    } else {
                        inlineQty += '<option value="1">NeoPost</option><option value="' + null + '" selected></option>';
                    }

                    /**
                     * Description - To get all the services selected for the package
                     */
                    inlineQty += '</select></td><td class=""><select multiple disabled class="form-control services_selected_class ">';
                    resultSet_service.forEachResult(function(searchResult_service) {

                        if (searchResult_service.getValue('custrecord_service') != 17) {
                            var option_shown = 'T';
                            var packages = searchResult_service.getValue('custrecord_service_package');
                            if (!isNullorEmpty(packages)) {
                                packages_array = packages.split(',');
                                for (var z = 0; z < packages_array.length; z++) {
                                    if (packages_array[z] == searchResult_package.getValue('internalid')) {
                                        inlineQty += '<option selected data-price="' + searchResult_service.getValue('custrecord_service_price') + '" value="' + searchResult_service.getValue('internalid') + '"  data-right="$' + searchResult_service.getValue('custrecord_service_price') + '" data-subtitle="' + searchResult_service.getValue('custrecord_service_description') + '">' + searchResult_service.getText('custrecord_service') + '</option>';
                                        total_per_package += parseFloat(searchResult_service.getValue('custrecord_service_price'));
                                        option_shown = 'F';
                                        serviceIDs.push(searchResult_service.getValue('internalid'));
                                    } else {

                                    }
                                }
                            }
                            if (option_shown == 'T') {
                                inlineQty += '<option data-price="' + searchResult_service.getValue('custrecord_service_price') + '" value="' + searchResult_service.getValue('internalid') + '" data-right="$' + searchResult_service.getValue('custrecord_service_price') + '" data-subtitle="' + searchResult_service.getValue('custrecord_service_description') + '">' + searchResult_service.getText('custrecord_service') + '</option>';
                            }
                        }

                        return true;
                    });
                    getNSItem(serviceIDs, packageType);
                    inlineQty += '</select></td>';

                    inlineQty += '<td><select disabled class="form-control period_type_class" name="period_type[' + row_count + ']" type="text" >';

                    /**
                     * Description - To get the discount period from the package record.
                     */
                    if (searchResult_package.getValue('custrecord_service_package_disc_period') == 1) {
                        inlineQty += '<option value="1" selected>per Visit</option><option value="2">per Day</option><option value="3">Monthly</option>';
                    } else if (searchResult_package.getValue('custrecord_service_package_disc_period') == 2) {
                        inlineQty += '<option value="1">per Visit</option><option value="2" selected>per Day</option><option value="3">Monthly</option>';
                    } else {
                        inlineQty += '<option value="1">per Visit</option><option value="2">per Day</option><option value="3" selected>Monthly</option>';
                    }

                    inlineQty += '</select></td><td><select disabled class="form-control single_line_class" name="single_line[' + row_count + ']" type="text" >';
                    /**
                     * Description - To get the Invoice in single line from the package record
                     */
                    if (searchResult_package.getValue('custrecord_service_package_inv_one_line') == 1) {
                        inlineQty += '<option value="1" selected>Yes</option><option value="2">No</option>';
                    } else {
                        inlineQty += '<option value="1">Yes</option><option value="2" selected>No</option>';
                    }



                    inlineQty += '</select></td><td><select disabled class="form-control invoice_incomplete_class" name="invoice_incomplete[' + row_count + ']" type="text" >';

                    /**
                     * Description - To get the invoice if incomplete value from the package record
                     */
                    if (searchResult_package.getValue('custrecord_service_package_inv_incomplet') == 1) {
                        inlineQty += '<option value="1" selected>Yes</option><option value="2">No</option>';
                    } else {
                        inlineQty += '<option value="1">Yes</option><option value="2" selected>No</option>';
                    }

                    inlineQty += '</select></td><td><select disabled class="form-control extras_included_class" name="invoice_incomplete[' + row_count + ']" type="text" >';

                    /**
                     * Description - To get the extras included value from the package record
                     */
                    if (searchResult_package.getValue('custrecord_service_package_extra_inc') == 1) {
                        inlineQty += '<option value="1" selected>Yes</option><option value="2">No</option>';
                    } else {
                        inlineQty += '<option value="1">Yes</option><option value="2" selected>No</option>';
                    }

                    // nlapiLogExecution('DEBUG', 'total_per_package', total_per_package);
                    // nlapiLogExecution('DEBUG', 'custrecord_service_package_fix_mth_rate', parseFloat(searchResult_package.getValue('custrecord_service_package_fix_mth_rate')));


                    var discount_display = total_per_package - parseFloat(searchResult_package.getValue('custrecord_service_package_fix_mth_rate'));

                    // nlapiLogExecution('DEBUG', 'discount_display', discount_display);


                    if (discount_display > 0) {
                        inlineQty += '</select></td><td style="display: none;"><div class="input-group discount_dollar has-error"><input type="hidden" class="discount_type" value="1" /><div class="input-group-addon">$</div>';
                    } else {
                        inlineQty += '</select></td><td style="display: none;"><div class="input-group discount_dollar has-success"><input type="hidden" class="discount_type" value="1" /><div class="input-group-addon">$</div>';
                    }


                    /**
                     * Description - To see if the discount needs to be filled based on the discount period. If its monthly then the discount gets filled.
                     */
                    if (searchResult_package.getValue('custrecord_service_package_disc_period') != 3) {

                        if (discount_display > 0) {
                            inlineQty += '<input class="form-control discount_class" name="discount[' + row_count + ']" type="number" disabled value="' + parseFloat(-discount_display) + '" pattern="^\d*(\.\d{2}$)?"/></div></td><td><div class="input-group has-success"><div class="input-group-addon">$</div>';
                        } else {
                            inlineQty += '<input class="form-control discount_class" name="discount[' + row_count + ']" type="number" disabled value="' + parseFloat(discount_display) + '" pattern="^\d*(\.\d{2}$)?"/></div></td><td><div class="input-group has-success"><div class="input-group-addon">$</div>';
                        }


                    } else {
                        inlineQty += '<input class="form-control discount_class" name="discount[' + row_count + ']" type="number" disabled value="' + parseFloat(searchResult_package.getValue('custrecord_service_package_disc_value')) + '" pattern="^\d*(\.\d{2}$)?"/></div></td><td><div class="input-group has-success"><div class="input-group-addon">$</div>';
                    }

                    if (searchResult_package.getValue('custrecord_service_package_disc_type') == 1) {
                        if (!isNullorEmpty(searchResult_package.getValue('custrecord_service_package_fix_mth_rate'))) {
                            inlineQty += '<input class="form-control total_class" step="any" name="total[' + row_count + ']" type="number" value="' + searchResult_package.getValue('custrecord_service_package_fix_mth_rate') + '" pattern="^\d*(\.\d{2}$)?" disabled />';
                        } else {
                            inlineQty += '<input class="form-control total_class" step="any" name="total[' + row_count + ']" type="number" value="' + (total_per_package - parseFloat(searchResult_package.getValue('custrecord_service_package_disc_value'))) + '" pattern="^\d*(\.\d{2}$)?" disabled />';
                        }

                    } else {
                        if (!isNullorEmpty(searchResult_package.getValue('custrecord_service_package_fix_mth_rate'))) {
                            inlineQty += '<input class="form-control total_class" step="any" name="total[' + row_count + ']" type="number" value="' + searchResult_package.getValue('custrecord_service_package_fix_mth_rate') + '" pattern="^\d*(\.\d{2}$)?" disabled />';
                        } else {
                            var discount_value = parseFloat(searchResult_package.getValue('custrecord_service_package_disc_value'));
                            inlineQty += '<input class="form-control total_class" step="any" name="total[' + row_count + ']" type="number" value="' + (total_per_package - ((discount_value / 100) * total_per_package)) + '" pattern="^\d*(\.\d{2}$)?" disabled />';
                        }

                    }

                    inlineQty += '</div>';
                    inlineQty += '</td>';
                    inlineQty += '<td><select disabled class="form-control nsItemName"><option></option>';
                    // nlapiLogExecution('DEBUG', 'id', searchResult_package.getValue("custrecord_service_package_ns_item"));
                    for (var i = 0; i < nsItemID.length; i++) {

                        if (!isNullorEmpty(searchResult_package.getValue("custrecord_service_package_ns_item"))) {
                            // nlapiLogExecution('DEBUG', 1);
                            if (nsItemID[i] == searchResult_package.getValue("custrecord_service_package_ns_item")) {
                                // nlapiLogExecution('DEBUG', 2);

                                inlineQty += '<option selected value="' + searchResult_package.getValue("custrecord_service_package_ns_item") + '">' + searchResult_package.getText("custrecord_service_package_ns_item") + '</option>';
                            } else {
                                // nlapiLogExecution('DEBUG', 3);
                                inlineQty += '<option value="' + nsItemID[i] + '">' + nsItemName[i] + '</option>';
                            }
                        } else {
                            // nlapiLogExecution('DEBUG', 132);
                            inlineQty += '<option value="' + nsItemID[i] + '">' + nsItemName[i] + '</option>';
                        }
                    }
                    inlineQty += '</select></td></tr>';
                }

                old_package_id = searchResult_package.getValue('internalid');
                return true;
            });
        }

        /**
         * Description - The last row on the page is generated from the below code
         */
        inlineQty += '<tr><td class="first_col"><button class="btn btn-success btn-sm add_class glyphicon glyphicon-plus" type="button" data-toggle="tooltip" data-placement="right" title="Add New Package"></button><input type="hidden" class="delete_package" value="F" /></td><td><div class="package_name_div"><input class="form-control package_name_class"  name="package_name[' + row_count + ']" type="text" /></div></td><td><input style="width: 155px" type="date" class="form-control date_effective" value="' + firstDayofMonth() + '"></td><td><select class="form-control package_type_class" name="package_type[' + row_count + ']" type="text" ><option value="1">NeoPost</option><option value="' + null + '" selected></option></select></td>';

        inlineQty += '<td class=""><div class="services_div"><select multiple class="form-control services_selected_class" ng-model="serviceSelected" ng-change="showSelectValue(serviceSelected)" name="services_selected[' + row_count + ']">';
        if (serviceResult.length != 0) {
            resultSet_service.forEachResult(function(searchResult_service) {
                if (searchResult_service.getValue('custrecord_service') != 17) {
                    inlineQty += '<option data-price="' + searchResult_service.getValue('custrecord_service_price') + '" value="' + searchResult_service.getValue('internalid') + '" data-right="$' + searchResult_service.getValue('custrecord_service_price') + '" data-subtitle="' + searchResult_service.getValue('custrecord_service_description') + '">' + searchResult_service.getText('custrecord_service') + '</option>';
                }
                return true;
            });
        }
        inlineQty += '</select></div></td><td><div class="period_type_div"><select class="form-control period_type_class" name="period_type[' + row_count + ']" required><option value="0"></option><option value="1">per Visit</option><option value="2">per Day</option><option value="3">Monthly</option></select></div></td><td><div class="single_line_div"><select class="form-control single_line_class" name="single_line[' + row_count + ']" required ><option value="0"></option><option value="1">Yes</option><option value="2">No</option></select></div></td>';
        inlineQty += '<td><div class="invoice_incomplete_div"><select class="form-control invoice_incomplete_class" name="invoice_incomplete[' + row_count + ']" type="text" ><option value="0"></option><option value="1">Yes</option><option value="2">No</option></div></select></td>';
        inlineQty += '<td><div class="extras_included_div"><select class="form-control extras_included_class" name="extras_included[' + row_count + ']" type="text" ><option value="0"></option><option value="1">Yes</option><option value="2">No</option></div></select></td><td style="display: none;"><div class="input-group discount_dollar has-error"><input type="hidden" class="discount_type" value="1" /><div class="input-group-addon">$</div>';
        // inlineQty +='<select class="form-control discount_type input-group-addon"><option value="1">$</option><option value="2">%</option></select>';
        inlineQty += '<input class="form-control discount_class" step="any" name="discount[' + row_count + ']" type="number" pattern="^\d*(\.\d{2}$)?" min="0" disabled /></div></div></td><td><div class="input-group has-success"><div class="input-group-addon">$</div><input class="form-control total_class" name="total[' + row_count + ']" step="any" pattern="^\d*(\.\d{2}$)?" type="number" /></div><span id="helpBlock" class="help-block hidden">Monthly</span></td><td><select disabled class="form-control nsItemName"><option></option></select></td></tr>';


        inlineQty += '</tbody>';
        inlineQty += '</table></div></div></div></form><br/>';
        inlineQty += '<div id="popup" title="Invoice Preview"></div>';

        var inlineQty2 = '<div class="se-pre-con"></div><div style=\"background-color: #cfeefc !important;border: 1px solid #417ed9;padding: 10px 10px 10px 20px;width:96%;position:absolute\"><b><u>IMPORTANT INSTRUCTIONS:<\/u><\/b><ul><li><b class="btn-xs glyphicon glyphicon-info-sign" disabled style="color: orange;"></b> - Click to get more <b>Information</b> on the column</li><li><b class="btn btn-warning btn-xs glyphicon glyphicon-pencil" disabled></b> - Click to <b>Edit</b> the Package</li><li><b class="btn btn-danger btn-xs  glyphicon glyphicon-trash" disabled></b> - Click to <b>Delete</b> the Package</li><li><b class="btn btn-primary btn-xs glyphicon glyphicon-new-window" disabled></b> - Click to <b>Preview</b> the Package in the invoice</li><li><b class="btn btn-success btn-xs glyphicon glyphicon-plus" disabled></b> - Click to <b>Add New</b> Package</li></ul><\/div><br\/><br\/><br\/><br\/><br\/><br\/><br\/><br\/><br\/><br\/>'

        form.addField('preview_table', 'inlinehtml', '').setLayoutType('outsidebelow', 'startrow').setDefaultValue(inlineQty);

        form.addField('custpage_html3', 'inlinehtml').setPadding(1).setLayoutType('outsideabove').setDefaultValue(inlineQty2);

        form.addSubmitButton('Save');
        // form.addButton('new_service', 'Create / Edit Services', 'addServices()')
        form.addButton('back', 'Back', 'onclick_back()');
        form.addButton('back', 'Reset', 'onclick_reset()');
        form.setScript('customscript_cl_mod_package');

        response.writePage(form);

    } else {

        var custId = parseInt(request.getParameter('custpage_customer_id'));

        var nsItem = request.getParameter('nsitem');
        var nsItemPrice = request.getParameter('nsitemprice');

        nlapiLogExecution('DEBUG', 'nsItem', nsItem);

        if (!isNullorEmpty(nsItem) && !isNullorEmpty(nsItemPrice)) {
            var item = nsItem.split(',');
            var price = nsItemPrice.split(',');


            var recCustomer = nlapiLoadRecord('customer', custId);
            var initial_size_of_financial = recCustomer.getLineItemCount('itempricing');
            for (var i = 0; i < item.length; i++) {
                initial_size_of_financial++;
                recCustomer.setLineItemValue('itempricing', 'item', initial_size_of_financial, item[i]);
                recCustomer.setLineItemValue('itempricing', 'level', initial_size_of_financial, -1);
                recCustomer.setLineItemValue('itempricing', 'price', initial_size_of_financial, price[i]);

            }

            nlapiSubmitRecord(recCustomer);
        }

        response.sendRedirect('RECORD', 'customer', custId, false);
    }
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