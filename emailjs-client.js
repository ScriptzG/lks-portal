/* LKS Systems — client-facing email notifications (portal.html & dashboard.html)
   Sends the client an email when they submit a new ticket, and again when
   staff reply to it. Replace the three values below with your EmailJS
   account's Public Key, Service ID and Template ID from emailjs.com — all
   three are safe to expose in browser code (that's how EmailJS is designed
   to be used). */

var EMAILJS_PUBLIC_KEY = "REPLACE_WITH_EMAILJS_PUBLIC_KEY";
var EMAILJS_SERVICE_ID = "REPLACE_WITH_EMAILJS_SERVICE_ID";
var EMAILJS_TEMPLATE_ID = "REPLACE_WITH_EMAILJS_TEMPLATE_ID";

var emailjsConfigured =
  EMAILJS_PUBLIC_KEY.indexOf("REPLACE_WITH") === -1 &&
  EMAILJS_SERVICE_ID.indexOf("REPLACE_WITH") === -1 &&
  EMAILJS_TEMPLATE_ID.indexOf("REPLACE_WITH") === -1;

if (emailjsConfigured && window.emailjs) {
  window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

/* Fires and forgets — a missing/failed notification should never block the
   ticket submission or reply itself, both of which already saved to Supabase
   by the time this is called. One template, reused for both notification
   types via the `heading` variable — see template variables below. */
function sendTicketNotification(toEmail, ticketSubject, heading, messageBody, ticketId) {
  if (!emailjsConfigured || !window.emailjs) return Promise.resolve();

  var portalLink = window.location.origin + "/portal?ticket=" + ticketId;

  return window.emailjs
    .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: toEmail,
      ticket_subject: ticketSubject,
      heading: heading,
      message_body: messageBody,
      portal_link: portalLink
    })
    .catch(function () {});
}
