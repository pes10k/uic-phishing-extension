__UIC(["pages", "config"], function (global, ns) {

    jQuery(function ($) {

        var $status_section = $("#status").hide(),
            display_status_msg = function (msg) {
                $status_section.text(msg);
                $status_section.fadeIn();
                window.setTimeout(function () {
                    $status_section.fadeOut();
                    $status_section.text("");
                }, 5000);
            },
            $email_field = $("#email"),
            $identifier_field = $("#secret-identifier"),
            $entrollment_date_field = $("#entrollment-date"),
            $check_in_date_field = $("#check-in-date"),
            $form_fields = $identifier_field
                .add($entrollment_date_field)
                    .add($check_in_date_field),
            $submit_button = $("#submit"),
            $reset_button = $("#reset"),
            $log_section = $("#log-section"),
            $log_table_body = $log_section.find("table tbody"),
            $refresh_logs_btn = $log_section.find("button#refresh-button"),
            $empty_logs_btn = $log_section.find("button#clear-button"),
            $log_btns = $refresh_logs_btn.add($empty_logs_btn),
            toggle_log_buttons = function (disable) {
                if (disable) {
                    $log_btns.attr("disabled", "disabled");
                } else {
                    $log_btns.removeAttr("disabled");
                }
            },
            referesh_logs = function () {
                $log_table_body.find("tr").remove();
                toggle_log_buttons(true);
                events.sendContentEvent("refresh-logs", null, function (logs) {

                    if (!logs || logs.length === 0) {

                        $log_table_body.html("<tr><td colspan='4'>No log messages to display</td></tr>");

                    } else {

                        $.each(logs.reverse(), function (index, a_log) {
                            var row = "<tr><td>" + (index + 1) + "</td>";
                            row += "<td>" + new Date(a_log[0]) + "</td>";
                            row += "<td>" + a_log[1] + "</td>";
                            row += "<td>" + a_log[2] + "</td></tr>";

                            $log_table_body.append(row);
                        });
                    }

                    toggle_log_buttons(false);
                });
                return false;
            },
            save_email,
            update_fields,
            format_date,
            events = global.platforms.events,
            consts = global.constants;

        format_date = function (a_date) {
            var cal = [a_date.getUTCMonth() + 1,
                       a_date.getDate(),
                       a_date.getFullYear()].join("/");
            return cal + " "  + a_date.toLocaleTimeString();
        };

        update_fields = function () {
            events.sendContentEvent("get-config", null, function (config) {

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
            events.sendContentEvent("set-email", {"email": $email_field.val()}, function (rs) {
                if (!rs) {
                    display_status_msg("There was an error registering your extension with the recording server.  Please try again later.");
                }
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
                events.sendContentEvent("reset-config", null, function () {
                    $email_field
                        .val("")
                        .removeAttr("readonly");
                    $form_fields.val("");
                });
                return false;
            });

        update_fields();

        // If the extension is in debug mode, then also expose and add in
        // functionality for the log section
        if (consts.debug) {
            $log_section.show();
            $refresh_logs_btn.click(referesh_logs);
            $empty_logs_btn.click(function () {
                toggle_log_buttons(true);
                events.sendContentEvent("empty-logs", null, function () {
                    referesh_logs();
                });
                return false;
            });
            referesh_logs();
        }
    });
});
