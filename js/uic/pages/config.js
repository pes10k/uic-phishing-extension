uic(["pages", "config"], function (global, ns) {

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
            format_date,
            events = global.platforms.events;

        format_date = function (a_date) {
            var cal = [a_date.getUTCMonth(), a_date.getDate(), a_date.getFullYear()].join("/");
            return cal + " "  + a_date.toLocaleTimeString();
        };

        update_fields = function () {
            events.sendClientEvent("get-config", null, function (config) {

                var start_date = config && config.start_date,
                    check_in_date = config && config.check_in_date;

                if (config && config.email) {

                    $email_field
                        .val(config.email)
                        .attr("readonly", "readonly");
                    $submit_button.attr("disabled", "disabled");

                } else {

                    $email_field
                        .val("")
                        .removeAttr("readonly");
                    $submit_button.removeAttr("disabled");
                }

                if (config && config['id']) {
                    $identifier_field.val(config['id']);
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
            events.sendClientEvent("set-email", {"email": $email_field.val()}, function () {
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
                events.sendClientEvent("reset-config", null, function () {
                    $email_field
                        .val("")
                        .removeAttr("readonly");
                    $form_fields.val("");
                });
                return false;
            });

        update_fields();
    });
});
