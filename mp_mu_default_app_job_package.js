var delete_record = false;

function main(type, id) {
      var job_record = nlapiLoadRecord(type, id);
      var service_id = job_record.getFieldValue('custrecord_job_service');
      job_record.setFieldValue('custrecord_job_service_package', null);

      var service_record = nlapiLoadRecord('customrecord_service', service_id);
      var service_type = service_record.getFieldValue('custrecord_service');
      if (service_type == 17) {
            delete_record = true;
            service_record.setFieldValues('custrecord_service_package', null);
            var new_service_id = nlapiSubmitRecord(service_record);
      }


      job_record.setFieldValue('custrecord_job_invoice_single_line_item', null);
      job_record.setFieldValue('custrecord_job_date_allocated', null);
      job_record.setFieldValue('custrecord_job_discount_type', null);
      job_record.setFieldValue('custrecord_package_job_groups', null);
      job_record.setFieldValue('custrecord_package_status', null);
      var new_job_id = nlapiSubmitRecord(job_record);

      if (delete_record == true) {
            nlapiDeleteRecord('customrecord_service', new_service_id);
            nlapiDeleteRecord('customrecord_job', new_job_id);
      }

}