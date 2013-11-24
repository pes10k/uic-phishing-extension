jQuery(function ($) {

    var $email_field = $("#email"),
        $identifier_field = $("#secret-identifier"),
        $entrollment_date_field = $("#entrollment-date"),
        $check_in_date_field = $("#check-in-date"),
        $form_fields = $identifier_field
            .add($entrollment_date_field)
                .add($check_in_date_field),
        $submit_button = $("#submit"),
        $reset_button = $("#reset"),
        save_email,
        update_fields,
        format_date;

    format_date = function (a_date) {
        var cal = [a_date.getUTCMonth(), a_date.getDate(), a_date.getFullYear()].join("/");
        return cal + " "  + a_date.toLocaleTimeString();
    };

    update_fields = function () {
        var msg = {"type": "get-config"};
        chrome.runtime.sendMessage(msg, function (response) {

            var start_date = response && response.start_date,
                check_in_date = response && response.check_in_date;

            if (response && response.email) {

                $email_field
                    .val(response.email)
                    .attr("readonly", "readonly");
                $submit_button.attr("disabled", "disabled");

            } else {

                $email_field
                    .val("")
                    .removeAttr("readonly");
                $submit_button.removeAttr("disabled");
            }

            if (response && response['id']) {
                $identifier_field.val(response['id']);
            }

            if (start_date) {
                $entrollment_date_field.val(format_date(new Date(start_date)));
            }

            if (check_in_date) {
                $check_in_date_field.val(format_date(new Date(check_in_date)));
            }
        });
    };

    save_email = function () {
        var msg = {"type": "set-email", "email": $email_field.val()};
        chrome.runtime.sendMessage(msg, function (response) {
            update_fields();
        });
        return false;
    };

    $submit_button
        .click(save_email)
        .attr("disabled", "disabled");

    $email_field
        .on("keydown", function () {
            $submit_button.removeAttr("disabled");
        });

    $reset_button
        .click(function () {
            chrome.runtime.sendMessage({"type": "reset-config"}, function () {
                $email_field
                    .val("")
                    .removeAttr("readonly");
                $form_fields.val("");
            });
            return false;
        });

    update_fields();
});
