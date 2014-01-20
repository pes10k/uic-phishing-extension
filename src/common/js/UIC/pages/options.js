__UIC(["pages", "config"], function (global, ns) {

KangoAPI.onReady(function () {

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
    save_email,
    update_fields,
    format_date;

format_date = function (a_date) {
    var cal = [a_date.getUTCMonth() + 1,
               a_date.getDate(),
               a_date.getFullYear()].join("/");
    return cal + " "  + a_date.toLocaleTimeString();
};

update_fields = function () {
    kango.dispatchMessage("request-for-config");
    return false;
};

kango.addMessageListener("response-for-config", function (event) {

    var config = event.data,
        start_date = config.registrationTime,
        check_in_date = config.checkInTime;

    if (config.email) {

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

    if (config.installId) {
        $identifier_field.val(config.installId);
    }

    if (start_date) {
        $entrollment_date_field.val(format_date(new Date(start_date * 1000)));
    }

    if (check_in_date) {
        $check_in_date_field.val(format_date(new Date(check_in_date * 1000)));
    }
});

save_email = function () {
    kango.dispatchMessage("request-set-email", $email_field.val());
    return false;
};

kango.addMessageListener("response-set-email", function (wasSuccess) {
    if (!wasSuccess.data) {
        display_status_msg("There was an error registering your extension with the recording server.  Please try again later.");
    }
    update_fields();
});

$submit_button
    .click(save_email)
    .attr("disabled", "disabled");

$email_field.on("keydown", function () {
    $submit_button.removeAttr("disabled");
});

$reset_button.click(function () {
    kango.dispatchMessage("request-reset-config");
    return false;
});

kango.addMessageListener("response-reset-config", function (event) {
    $email_field
        .val("")
        .removeAttr("readonly");
    $form_fields.val("");
});

update_fields();

});

});
